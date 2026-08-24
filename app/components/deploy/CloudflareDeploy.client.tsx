import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { chatId } from '~/lib/persistence/useChatHistory';
import { description } from '~/lib/persistence';
import { formatBuildFailureOutput } from './deployUtils';
import { recordDeployedApp } from '~/lib/deployedApps';

/**
 * Cloudflare Pages project names allow only lowercase letters, digits and hyphens (max 58 chars).
 * chatId comes from the `ai` SDK's generateId(), which is not guaranteed to be lowercase-only, so
 * this can't skip sanitizing and still assume the id is already valid.
 */
function toProjectName(rawChatId: string): string {
  const sanitized = rawChatId.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const suffix = sanitized.slice(0, 45) || 'app';

  return `coralred-app-${suffix}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

export function useCloudflareDeploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const currentChatId = useStore(chatId);

  const handleCloudflareDeploy = async () => {
    /*
     * Guards re-entry at the source, not just via the caller's disabled-button state — a fast
     * double-click can fire this before React has re-rendered the button as disabled.
     */
    if (isDeploying) {
      return false;
    }

    if (!currentChatId) {
      toast.error('진행 중인 채팅이 없어요.');
      return false;
    }

    try {
      setIsDeploying(true);

      const artifact = workbenchStore.firstArtifact;

      if (!artifact) {
        throw new Error('배포할 프로젝트를 찾지 못했어요.');
      }

      const deploymentId = 'deploy-artifact';
      workbenchStore.addArtifact({
        id: deploymentId,
        messageId: deploymentId,
        title: 'Cloudflare Pages 배포',
        type: 'standalone',
      });

      const deployArtifact = workbenchStore.artifacts.get()[deploymentId];

      deployArtifact.runner.handleDeployAction('building', 'running', { source: 'cloudflare' });

      const actionId = 'build-' + Date.now();
      const actionData: ActionCallbackData = {
        messageId: 'cloudflare build',
        artifactId: artifact.id,
        actionId,
        action: { type: 'build' as const, content: 'npm run build' },
      };

      artifact.runner.addAction(actionData);
      await artifact.runner.runAction(actionData);

      const buildOutput = artifact.runner.buildOutput;

      if (!buildOutput || buildOutput.exitCode !== 0) {
        deployArtifact.runner.handleDeployAction('building', 'failed', {
          error: formatBuildFailureOutput(buildOutput?.output),
          source: 'cloudflare',
        });
        throw new Error('빌드에 실패했어요.');
      }

      deployArtifact.runner.handleDeployAction('deploying', 'running', { source: 'cloudflare' });

      const container = await webcontainer;
      const buildPath = buildOutput.path.replace('/home/project', '');

      let finalBuildPath = buildPath;
      let buildPathExists = false;

      for (const dir of [buildPath, '/dist', '/build', '/out', '/output']) {
        try {
          await container.fs.readdir(dir);
          finalBuildPath = dir;
          buildPathExists = true;
          break;
        } catch {
          continue;
        }
      }

      if (!buildPathExists) {
        throw new Error('빌드 결과물 폴더를 찾지 못했어요.');
      }

      /*
       * Binary-safe (unlike the text-only Netlify/Vercel collectors) — reads raw bytes so images,
       * fonts, etc. don't get corrupted by a utf-8 round-trip, then base64s for the JSON payload.
       */
      async function getAllFiles(dirPath: string): Promise<Record<string, string>> {
        const files: Record<string, string> = {};
        const entries = await container.fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isFile()) {
            const content = await container.fs.readFile(fullPath);
            const deployPath = fullPath.replace(finalBuildPath, '').replace(/^\/+/, '');
            files[deployPath] = bytesToBase64(content);
          } else if (entry.isDirectory()) {
            Object.assign(files, await getAllFiles(fullPath));
          }
        }

        return files;
      }

      const fileContents = await getAllFiles(finalBuildPath);
      const projectName = toProjectName(currentChatId);

      const response = await fetch('/api/cloudflare-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, files: fileContents }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        url?: string;
        error?: string;
        isFirstDeploy?: boolean;
      };

      if (!response.ok || !data.success || !data.url) {
        const errorMessage = data.error || '배포에 실패했어요. 잠시 후 다시 시도해주세요.';
        deployArtifact.runner.handleDeployAction('deploying', 'failed', { error: errorMessage, source: 'cloudflare' });
        throw new Error(errorMessage);
      }

      deployArtifact.runner.handleDeployAction('complete', 'complete', {
        url: data.url,
        source: 'cloudflare',

        /*
         * Only the very first deploy of a brand-new project — the address itself isn't "new"
         * again on every redeploy after that, so this stays a one-time caveat, not standing noise.
         */
        note: data.isFirstDeploy ? '방금 만든 주소예요. 1분 정도 후에 다시 열어보면 더 잘 열려요.' : undefined,
      });

      recordDeployedApp({
        chatId: currentChatId,
        appName: description.get() || 'Untitled',
        url: data.url,
        provider: 'cloudflare',
        projectName,
      });

      toast.success('배포가 끝났어요!');

      return true;
    } catch (error) {
      console.error('Cloudflare deploy error:', error instanceof Error ? error.message : error);
      toast.error(error instanceof Error ? error.message : '배포에 실패했어요. 잠시 후 다시 시도해주세요.');

      return false;
    } finally {
      setIsDeploying(false);
    }
  };

  return { isDeploying, handleCloudflareDeploy };
}
