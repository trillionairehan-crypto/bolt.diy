import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { useState } from 'react';
import type { WebContainer } from '@webcontainer/api';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { chatId } from '~/lib/persistence/useChatHistory';
import { description } from '~/lib/persistence';
import { formatBuildFailureOutput } from './deployUtils';
import { recordDeployedApp } from '~/lib/deployedApps';
import { supabaseConnection } from '~/lib/stores/supabase';
import { isServiceRoleKey } from '~/lib/supabase/keyRole';

const ENV_FILE_PATH = '.env';

/**
 * Vite inlines VITE_* env vars at build time, so this has to run before `npm run build` — writing
 * the connected Supabase credentials directly rather than trusting that the AI already wrote a
 * matching .env for this chat's current connection (it's instructed to, in new-prompt.ts, but only
 * when the message that triggered generation had a connection already selected; connecting later
 * via the wizard doesn't retroactively touch already-written project files). Deploying without a
 * connection is untouched — an unconnected app must keep working in its sample-data mode, so this
 * only ever adds/updates the two Supabase keys, never the file's absence or its other lines.
 *
 * Hard-refuses to inject (throws, aborting the whole deploy) if the stored anon key turns out to
 * decode as a service_role key — a second checkpoint independent of the one in
 * useSupabaseConnection's handleSimpleConnect, since that only guards the wizard's own input path.
 *
 * @returns whether credentials were actually injected — recordDeployedApp uses this for /apps'
 * "샘플 데이터" vs "저장 기능 연결됨" badge, so it reflects what THIS build actually got rather
 * than re-deriving it from possibly-since-changed connection state.
 */
async function injectSupabaseEnv(container: WebContainer): Promise<boolean> {
  const { credentials } = supabaseConnection.get();
  const supabaseUrl = credentials?.supabaseUrl;
  const anonKey = credentials?.anonKey;

  if (!supabaseUrl || !anonKey) {
    return false;
  }

  if (isServiceRoleKey(anonKey)) {
    throw new Error('저장 기능 키가 올바르지 않아요. 코랄레드 팀에 문의해주세요.');
  }

  let existingContent = '';

  try {
    existingContent = new TextDecoder().decode(await container.fs.readFile(ENV_FILE_PATH));
  } catch {
    // No .env yet — fine, we'll create one with just these two lines.
  }

  const desired: Record<string, string> = {
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: anonKey,
  };
  const remainingKeys = new Set(Object.keys(desired));

  const lines = existingContent.split('\n').map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    const key = match?.[1];

    if (key && key in desired) {
      remainingKeys.delete(key);
      return `${key}=${desired[key]}`;
    }

    return line;
  });

  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  for (const key of remainingKeys) {
    lines.push(`${key}=${desired[key]}`);
  }

  await container.fs.writeFile(ENV_FILE_PATH, lines.join('\n') + '\n');

  return true;
}

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

      const container = await webcontainer;
      const supabaseInjected = await injectSupabaseEnv(container);

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
        supabaseConnected: supabaseInjected,
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
