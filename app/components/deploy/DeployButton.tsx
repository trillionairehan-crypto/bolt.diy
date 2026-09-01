import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useStore } from '@nanostores/react';
import { netlifyConnection } from '~/lib/stores/netlify';
import { vercelConnection } from '~/lib/stores/vercel';
import { isGitLabConnected } from '~/lib/stores/gitlabConnection';
import { workbenchStore } from '~/lib/stores/workbench';
import { streamingState } from '~/lib/stores/streaming';
import { classNames } from '~/utils/classNames';
import { SHOW_DEV_TOOLS } from '~/utils/featureFlags';
import { useState } from 'react';
import { NetlifyDeploymentLink } from '~/components/chat/NetlifyDeploymentLink.client';
import { VercelDeploymentLink } from '~/components/chat/VercelDeploymentLink.client';
import { useVercelDeploy } from '~/components/deploy/VercelDeploy.client';
import { useNetlifyDeploy } from '~/components/deploy/NetlifyDeploy.client';
import { useCloudflareDeploy } from '~/components/deploy/CloudflareDeploy.client';
import { useGitHubDeploy } from '~/components/deploy/GitHubDeploy.client';
import { useGitLabDeploy } from '~/components/deploy/GitLabDeploy.client';
import { GitHubDeploymentDialog } from '~/components/deploy/GitHubDeploymentDialog';
import { GitLabDeploymentDialog } from '~/components/deploy/GitLabDeploymentDialog';

interface DeployButtonProps {
  onVercelDeploy?: () => Promise<void>;
  onNetlifyDeploy?: () => Promise<void>;
  onGitHubDeploy?: () => Promise<void>;
  onGitLabDeploy?: () => Promise<void>;
  onCloudflareDeploy?: () => Promise<void>;
}

export const DeployButton = ({
  onVercelDeploy,
  onNetlifyDeploy,
  onGitHubDeploy,
  onGitLabDeploy,
  onCloudflareDeploy,
}: DeployButtonProps) => {
  const netlifyConn = useStore(netlifyConnection);
  const vercelConn = useStore(vercelConnection);
  const gitlabIsConnected = useStore(isGitLabConnected);
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployingTo, setDeployingTo] = useState<'netlify' | 'vercel' | 'github' | 'gitlab' | 'cloudflare' | null>(
    null,
  );
  const isStreaming = useStore(streamingState);
  const { handleVercelDeploy } = useVercelDeploy();
  const { handleNetlifyDeploy } = useNetlifyDeploy();
  const { handleGitHubDeploy } = useGitHubDeploy();
  const { handleGitLabDeploy } = useGitLabDeploy();
  const { handleCloudflareDeploy } = useCloudflareDeploy();
  const [showGitHubDeploymentDialog, setShowGitHubDeploymentDialog] = useState(false);
  const [showGitLabDeploymentDialog, setShowGitLabDeploymentDialog] = useState(false);
  const [githubDeploymentFiles, setGithubDeploymentFiles] = useState<Record<string, string> | null>(null);
  const [gitlabDeploymentFiles, setGitlabDeploymentFiles] = useState<Record<string, string> | null>(null);
  const [githubProjectName, setGithubProjectName] = useState('');
  const [gitlabProjectName, setGitlabProjectName] = useState('');

  const handleVercelDeployClick = async () => {
    setIsDeploying(true);
    setDeployingTo('vercel');

    try {
      if (onVercelDeploy) {
        await onVercelDeploy();
      } else {
        await handleVercelDeploy();
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  const handleNetlifyDeployClick = async () => {
    setIsDeploying(true);
    setDeployingTo('netlify');

    try {
      if (onNetlifyDeploy) {
        await onNetlifyDeploy();
      } else {
        await handleNetlifyDeploy();
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  const handleGitHubDeployClick = async () => {
    setIsDeploying(true);
    setDeployingTo('github');

    try {
      if (onGitHubDeploy) {
        await onGitHubDeploy();
      } else {
        const result = await handleGitHubDeploy();

        if (result && result.success && result.files) {
          setGithubDeploymentFiles(result.files);
          setGithubProjectName(result.projectName);
          setShowGitHubDeploymentDialog(true);
        }
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  const handleCloudflareDeployClick = async () => {
    setIsDeploying(true);
    setDeployingTo('cloudflare');

    try {
      if (onCloudflareDeploy) {
        await onCloudflareDeploy();
      } else {
        await handleCloudflareDeploy();
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  const handleGitLabDeployClick = async () => {
    setIsDeploying(true);
    setDeployingTo('gitlab');

    try {
      if (onGitLabDeploy) {
        await onGitLabDeploy();
      } else {
        const result = await handleGitLabDeploy();

        if (result && result.success && result.files) {
          setGitlabDeploymentFiles(result.files);
          setGitlabProjectName(result.projectName);
          setShowGitLabDeploymentDialog(true);
        }
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  const itemClassName = classNames(
    'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
  );

  return (
    <>
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden text-sm">
        {/* Cloudflare is the default, one-click action — no external account needed, unlike the
            options below. The dropdown next to it is only for the other, account-gated providers. */}
        <button
          type="button"
          onClick={handleCloudflareDeployClick}
          disabled={isDeploying || !activePreview || isStreaming}
          title={isDeploying && deployingTo ? `${deployingTo}에 배포하고 있어요` : undefined}
          className="items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-3 py-1.5 text-xs bg-[var(--accent)] text-[var(--on-accent)] [&:not(:disabled,.disabled)]:hover:opacity-[0.85] outline-[var(--accent)] flex gap-1.5"
        >
          {isDeploying && deployingTo === 'cloudflare' ? '배포 중...' : '배포하기'}
        </button>

        {/* 개발자용 UI 정리 (overnight5) — Netlify/Vercel/GitHub/GitLab 내보내기 옵션은 개발자 모드에서만.
            기본 화면은 Cloudflare 원클릭 배포만 남긴다. */}
        {SHOW_DEV_TOOLS && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              disabled={isDeploying || !activePreview || isStreaming}
              aria-label="다른 방법으로 내보내기"
              className="border-l border-[var(--on-accent)]/20 items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-2 py-1.5 bg-[var(--accent)] text-[var(--on-accent)] [&:not(:disabled,.disabled)]:hover:opacity-[0.85] outline-[var(--accent)] flex"
            >
              <span className={classNames('i-ph:caret-down transition-transform')} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              className={classNames(
                'z-[250] min-w-[220px]',
                'bg-bolt-elements-background-depth-2',
                'rounded-lg shadow-lg',
                'border border-bolt-elements-borderColor',
                'animate-in fade-in-0 zoom-in-95',
                'py-1',
              )}
              sideOffset={5}
              align="end"
            >
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className={itemClassName}>
                  <span>다른 방법으로 내보내기</span>
                  <span className="i-ph:caret-right ml-auto text-bolt-elements-textTertiary" />
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent
                    className={classNames(
                      'z-[250] min-w-[220px]',
                      'bg-bolt-elements-background-depth-2',
                      'rounded-lg shadow-lg',
                      'border border-bolt-elements-borderColor',
                      'animate-in fade-in-0 zoom-in-95',
                      'py-1',
                    )}
                    sideOffset={4}
                    alignOffset={-4}
                  >
                    <DropdownMenu.Item
                      className={classNames(itemClassName, {
                        'opacity-60 cursor-not-allowed': isDeploying || !activePreview || !netlifyConn.user,
                      })}
                      disabled={isDeploying || !activePreview || !netlifyConn.user}
                      onClick={handleNetlifyDeployClick}
                    >
                      <img
                        className="w-5 h-5"
                        height="24"
                        width="24"
                        crossOrigin="anonymous"
                        src="https://cdn.simpleicons.org/netlify"
                      />
                      <span className="mx-auto">
                        {!netlifyConn.user ? 'Netlify 계정을 먼저 연결해주세요' : 'Netlify로 내보내기'}
                      </span>
                      {netlifyConn.user && <NetlifyDeploymentLink />}
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                      className={classNames(itemClassName, {
                        'opacity-60 cursor-not-allowed': isDeploying || !activePreview || !vercelConn.user,
                      })}
                      disabled={isDeploying || !activePreview || !vercelConn.user}
                      onClick={handleVercelDeployClick}
                    >
                      <img
                        className="w-5 h-5 bg-black p-1 rounded"
                        height="24"
                        width="24"
                        crossOrigin="anonymous"
                        src="https://cdn.simpleicons.org/vercel/white"
                        alt="vercel"
                      />
                      <span className="mx-auto">
                        {!vercelConn.user ? 'Vercel 계정을 먼저 연결해주세요' : 'Vercel로 내보내기'}
                      </span>
                      {vercelConn.user && <VercelDeploymentLink />}
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                      className={classNames(itemClassName, {
                        'opacity-60 cursor-not-allowed': isDeploying || !activePreview,
                      })}
                      disabled={isDeploying || !activePreview}
                      onClick={handleGitHubDeployClick}
                    >
                      <img
                        className="w-5 h-5"
                        height="24"
                        width="24"
                        crossOrigin="anonymous"
                        src="https://cdn.simpleicons.org/github"
                        alt="github"
                      />
                      <span className="mx-auto">GitHub로 내보내기</span>
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                      className={classNames(itemClassName, {
                        'opacity-60 cursor-not-allowed': isDeploying || !activePreview || !gitlabIsConnected,
                      })}
                      disabled={isDeploying || !activePreview || !gitlabIsConnected}
                      onClick={handleGitLabDeployClick}
                    >
                      <img
                        className="w-5 h-5"
                        height="24"
                        width="24"
                        crossOrigin="anonymous"
                        src="https://cdn.simpleicons.org/gitlab"
                        alt="gitlab"
                      />
                      <span className="mx-auto">
                        {!gitlabIsConnected ? 'GitLab 계정을 먼저 연결해주세요' : 'GitLab으로 내보내기'}
                      </span>
                    </DropdownMenu.Item>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
      </div>

      {/* GitHub Deployment Dialog */}
      {showGitHubDeploymentDialog && githubDeploymentFiles && (
        <GitHubDeploymentDialog
          isOpen={showGitHubDeploymentDialog}
          onClose={() => setShowGitHubDeploymentDialog(false)}
          projectName={githubProjectName}
          files={githubDeploymentFiles}
        />
      )}

      {/* GitLab Deployment Dialog */}
      {showGitLabDeploymentDialog && gitlabDeploymentFiles && (
        <GitLabDeploymentDialog
          isOpen={showGitLabDeploymentDialog}
          onClose={() => setShowGitLabDeploymentDialog(false)}
          projectName={gitlabProjectName}
          files={gitlabDeploymentFiles}
        />
      )}
    </>
  );
};
