import { AnimatePresence, motion } from 'framer-motion';
import type { SupabaseAlert } from '~/types/actions';
import { classNames } from '~/utils/classNames';
import { supabaseConnection } from '~/lib/stores/supabase';
import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { toast } from 'react-toastify';

interface Props {
  alert: SupabaseAlert;
  clearAlert: () => void;
  postMessage: (message: string) => void;
}

export function SupabaseChatAlert({ alert, clearAlert, postMessage }: Props) {
  const { content } = alert;
  const connection = useStore(supabaseConnection);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Any connection (either flow) — enough to say "저장 기능 켜짐" and show the SQL at all.
  const isConnected = !!connection.isConnected;

  /*
   * Auto-running this SQL against the user's database needs Supabase's Management API, which
   * only a personal-access-token connection (token + selectedProjectId) can call — the
   * simplified project URL + anon key flow's anon key has no Management API access at all, by
   * design (that's a whole-account-scoped credential, not something this app should ever ask a
   * non-developer to paste in — see the connection wizard in SupabaseConnection.tsx). Connected-
   * but-can't-auto-apply is a real, reachable state, not just "not connected".
   */
  const canAutoApply = !!(connection.token && connection.selectedProjectId);

  const projectRef = connection.credentials?.supabaseUrl?.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/i)?.[1];
  const sqlEditorUrl = projectRef ? `https://supabase.com/dashboard/project/${projectRef}/sql/new` : undefined;

  // Set title and description based on connection state
  const title = !isConnected ? '저장 기능 연결 필요' : canAutoApply ? '저장 기능 변경 사항' : '직접 실행이 필요해요';
  const description = isConnected ? '저장 기능 변경 내용' : '저장 기능 연결이 필요해요';
  const message = !isConnected
    ? '계속하려면 먼저 저장 기능을 연결해주세요.'
    : canAutoApply
      ? '제안된 변경 사항을 확인하고 저장 기능에 적용해주세요.'
      : 'Supabase SQL 편집기에 아래 내용을 붙여넣고 실행해주세요.';

  const handleConnectClick = () => {
    // Dispatch an event to open the Supabase connection dialog
    document.dispatchEvent(new CustomEvent('open-supabase-connection'));
  };

  // Determine if we should show the Connect button or Apply Changes button
  const showConnectButton = !isConnected;

  const executeSupabaseAction = async (sql: string) => {
    if (!connection.token || !connection.selectedProjectId) {
      console.error('No Supabase token or project selected');
      return;
    }

    setIsExecuting(true);

    try {
      const response = await fetch('/api/supabase/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${connection.token}`,
        },
        body: JSON.stringify({
          projectId: connection.selectedProjectId,
          query: sql,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(`Supabase 저장 기능 적용에 실패했어요: ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      console.log('Supabase query executed successfully:', result);
      clearAlert();
    } catch (error) {
      console.error('Failed to execute Supabase action:', error);
      postMessage(
        `*Supabase 저장 기능을 적용하다가 문제가 생겼어요. 고쳐서 다시 알려줘*\n\`\`\`\n${error instanceof Error ? error.message : String(error)}\n\`\`\`\n`,
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const cleanSqlContent = (content: string) => {
    if (!content) {
      return '';
    }

    let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');

    cleaned = cleaned.replace(/(--).*$/gm, '').replace(/(#).*$/gm, '');

    const statements = cleaned
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0)
      .join(';\n\n');

    return statements;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="max-w-chat rounded-lg border-l-2 border-l-[#098F5F] border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2"
      >
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex items-center gap-2">
            <img height="10" width="18" crossOrigin="anonymous" src="https://cdn.simpleicons.org/supabase" alt="" />
            <h3 className="text-sm font-medium text-[#3DCB8F]">{title}</h3>
          </div>
        </div>

        {/* SQL Content — third branch (connected, !canAutoApply) is the simplified anon-key-only
            flow: no Management API access, so it's shown open (not collapsed) for copying instead
            of an auto-run toggle. */}
        <div className="px-4">
          {!isConnected ? (
            <div className="p-3 rounded-md bg-bolt-elements-background-depth-3">
              <span className="text-sm text-bolt-elements-textPrimary">먼저 저장 기능을 연결해주세요.</span>
            </div>
          ) : canAutoApply ? (
            <>
              <div
                className="flex items-center p-2 rounded-md bg-bolt-elements-background-depth-3 cursor-pointer"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                <div className="i-ph:database text-bolt-elements-textPrimary mr-2"></div>
                <span className="text-sm text-bolt-elements-textPrimary flex-grow">
                  {description || '테이블 생성 및 인증 설정'}
                </span>
                <div
                  className={`i-ph:caret-up text-bolt-elements-textPrimary transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                ></div>
              </div>

              {!isCollapsed && content && (
                <div className="mt-2 p-3 bg-bolt-elements-background-depth-4 rounded-md overflow-auto max-h-60 font-mono text-xs text-bolt-elements-textSecondary">
                  <pre>{cleanSqlContent(content)}</pre>
                </div>
              )}
            </>
          ) : (
            <div className="p-3 bg-bolt-elements-background-depth-4 rounded-md overflow-auto max-h-60 font-mono text-xs text-bolt-elements-textSecondary">
              <pre>{cleanSqlContent(content)}</pre>
            </div>
          )}
        </div>

        {/* Message and Actions */}
        <div className="p-4">
          <p className="text-sm text-bolt-elements-textSecondary mb-4">{message}</p>

          <div className="flex gap-2">
            {showConnectButton ? (
              <button
                onClick={handleConnectClick}
                className={classNames(
                  `px-3 py-2 rounded-md text-sm font-medium`,
                  'bg-[#098F5F]',
                  'hover:bg-[#0aa06c]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
                  'text-white',
                  'flex items-center gap-1.5',
                )}
              >
                저장 기능 연결하기
              </button>
            ) : canAutoApply ? (
              <button
                onClick={() => executeSupabaseAction(content)}
                disabled={isExecuting}
                className={classNames(
                  `px-3 py-2 rounded-md text-sm font-medium`,
                  'bg-[#098F5F]',
                  'hover:bg-[#0aa06c]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
                  'text-white',
                  'flex items-center gap-1.5',
                  isExecuting ? 'opacity-70 cursor-not-allowed' : '',
                )}
              >
                {isExecuting ? '적용 중...' : '변경사항 적용'}
              </button>
            ) : (
              <>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(cleanSqlContent(content));
                      toast.success('복사했어요');
                    } catch {
                      toast.error('복사하지 못했어요.');
                    }
                  }}
                  className={classNames(
                    `px-3 py-2 rounded-md text-sm font-medium`,
                    'bg-[#098F5F]',
                    'hover:bg-[#0aa06c]',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
                    'text-white',
                    'flex items-center gap-1.5',
                  )}
                >
                  <div className="i-ph:copy w-4 h-4" />
                  SQL 복사
                </button>
                {sqlEditorUrl && (
                  <a
                    href={sqlEditorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classNames(
                      `px-3 py-2 rounded-md text-sm font-medium`,
                      'bg-bolt-elements-button-secondary-background',
                      'hover:bg-bolt-elements-button-secondary-backgroundHover',
                      'text-bolt-elements-button-secondary-text',
                      'flex items-center gap-1.5',
                    )}
                  >
                    <div className="i-ph:arrow-square-out w-4 h-4" />
                    SQL 편집기 열기
                  </a>
                )}
              </>
            )}
            <button
              onClick={clearAlert}
              disabled={isExecuting}
              className={classNames(
                `px-3 py-2 rounded-md text-sm font-medium`,
                'bg-bolt-elements-button-secondary-background',
                'hover:bg-bolt-elements-button-secondary-backgroundHover',
                'focus:outline-none',
                'text-bolt-elements-button-secondary-text',
                isExecuting ? 'opacity-70 cursor-not-allowed' : '',
              )}
            >
              닫기
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
