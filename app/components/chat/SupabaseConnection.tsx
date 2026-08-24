import { useEffect, useState } from 'react';
import { useSupabaseConnection } from '~/lib/hooks/useSupabaseConnection';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { chatId } from '~/lib/persistence/useChatHistory';
import { fetchSupabaseStats } from '~/lib/stores/supabase';
import { Dialog, DialogRoot, DialogClose, DialogTitle, DialogButton } from '~/components/ui/Dialog';
import { isOpenSupabaseConnectionMessage } from '~/lib/supabase/previewBridge';

interface SupabaseConnectionProps {
  showLabel?: boolean;
}

const inputClassName = classNames(
  'w-full px-3 py-2 rounded-lg text-sm',
  'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
  'border border-[#E5E5E5] dark:border-[#333333]',
  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
  'focus:outline-none focus:ring-1 focus:ring-[#3ECF8E]',
  'disabled:opacity-50',
);

export function SupabaseConnection({ showLabel = true }: SupabaseConnectionProps) {
  const {
    connection: supabaseConn,
    connecting,
    fetchingStats,
    isProjectsExpanded,
    setIsProjectsExpanded,
    isDropdownOpen: isDialogOpen,
    setIsDropdownOpen: setIsDialogOpen,
    handleSimpleConnect,
    simpleConnecting,
    simpleConnectError,
    handleDisconnect,
    selectProject,
    handleCreateProject,
    isConnected,
    fetchProjectApiKeys,
  } = useSupabaseConnection();

  const [simpleUrl, setSimpleUrl] = useState('');
  const [simpleAnonKey, setSimpleAnonKey] = useState('');

  const currentChatId = useStore(chatId);

  useEffect(() => {
    const handleOpenConnectionDialog = () => {
      setIsDialogOpen(true);
    };

    /*
     * The generated app's own "샘플 데이터로 보고 있어요" banner runs inside the WebContainer
     * preview iframe (a separate document) and can only reach this host page via postMessage —
     * see previewBridge.ts for the shared message contract with new-prompt.ts's banner instructions.
     */
    const handlePreviewMessage = (event: MessageEvent) => {
      if (isOpenSupabaseConnectionMessage(event.data)) {
        setIsDialogOpen(true);
      }
    };

    document.addEventListener('open-supabase-connection', handleOpenConnectionDialog);
    window.addEventListener('message', handlePreviewMessage);

    return () => {
      document.removeEventListener('open-supabase-connection', handleOpenConnectionDialog);
      window.removeEventListener('message', handlePreviewMessage);
    };
  }, [setIsDialogOpen]);

  useEffect(() => {
    if (isConnected && currentChatId) {
      const savedProjectId = localStorage.getItem(`supabase-project-${currentChatId}`);

      /*
       * If there's no saved project for this chat but there is a global selected project,
       * use the global one instead of clearing it
       */
      if (!savedProjectId && supabaseConn.selectedProjectId) {
        // Save the current global project to this chat
        localStorage.setItem(`supabase-project-${currentChatId}`, supabaseConn.selectedProjectId);
      } else if (savedProjectId && savedProjectId !== supabaseConn.selectedProjectId) {
        selectProject(savedProjectId);
      }
    }
  }, [isConnected, currentChatId]);

  useEffect(() => {
    if (currentChatId && supabaseConn.selectedProjectId) {
      localStorage.setItem(`supabase-project-${currentChatId}`, supabaseConn.selectedProjectId);
    } else if (currentChatId && !supabaseConn.selectedProjectId) {
      localStorage.removeItem(`supabase-project-${currentChatId}`);
    }
  }, [currentChatId, supabaseConn.selectedProjectId]);

  useEffect(() => {
    if (isConnected && supabaseConn.token) {
      fetchSupabaseStats(supabaseConn.token).catch(console.error);
    }
  }, [isConnected, supabaseConn.token]);

  useEffect(() => {
    if (isConnected && supabaseConn.selectedProjectId && supabaseConn.token && !supabaseConn.credentials) {
      fetchProjectApiKeys(supabaseConn.selectedProjectId).catch(console.error);
    }
  }, [isConnected, supabaseConn.selectedProjectId, supabaseConn.token, supabaseConn.credentials]);

  /*
   * The richer project-browsing view only makes sense for the old personal-access-token flow —
   * the simplified wizard never populates `user`, so this tells the two states apart.
   */
  const isPatConnection = isConnected && !!supabaseConn.user;

  const handleWizardConnect = async () => {
    const success = await handleSimpleConnect(simpleUrl, simpleAnonKey);

    if (success) {
      setSimpleUrl('');
      setSimpleAnonKey('');
    }
  };

  return (
    <div className="relative">
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden mr-2 text-sm">
        <Button
          active
          disabled={connecting}
          onClick={() => setIsDialogOpen(!isDialogOpen)}
          className={classNames(
            'hover:bg-bolt-elements-item-backgroundActive !text-white flex items-center gap-2 whitespace-nowrap',
            { '!px-2': !showLabel },
          )}
          title={isConnected ? '저장 기능이 켜졌어요' : '앱에 로그인과 저장 기능을 쓰려면 연결이 필요해요'}
        >
          <img
            className="w-4 h-4 shrink-0"
            height="20"
            width="20"
            crossOrigin="anonymous"
            src="https://cdn.simpleicons.org/supabase"
            alt=""
          />
          {showLabel && <span className="ml-1 text-xs">{isConnected ? 'Supabase 연결됨' : 'Supabase 연결'}</span>}
        </Button>
      </div>

      <DialogRoot open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {isDialogOpen && (
          <Dialog className="max-w-[520px] p-6">
            {!isConnected ? (
              <div className="space-y-5">
                <DialogTitle>
                  <img
                    className="w-5 h-5"
                    height="24"
                    width="24"
                    crossOrigin="anonymous"
                    src="https://cdn.simpleicons.org/supabase"
                    alt=""
                  />
                  저장 기능 연결하기
                </DialogTitle>
                <p className="text-sm text-bolt-elements-textSecondary -mt-3">
                  회원가입, 목록 저장처럼 데이터가 남아야 하는 기능을 쓰려면 Supabase라는 무료 저장소를 연결해야 해요.
                  3단계면 끝나요.
                </p>

                {/* Step 1 */}
                <div className="flex gap-3">
                  <StepBadge>1</StepBadge>
                  <div className="flex-1 space-y-2">
                    <h4 className="text-sm font-medium text-bolt-elements-textPrimary">Supabase 가입하기</h4>
                    <p className="text-sm text-bolt-elements-textSecondary">
                      아직 계정이 없다면 먼저 가입해주세요. 가입 화면에서 "Continue with GitHub" 버튼으로 시작하는 게
                      가장 빨라요. GitHub 계정이 없다면 이메일로도 가입할 수 있어요.
                    </p>
                    <a
                      href="https://supabase.com/dashboard/sign-up"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-[#3ECF8E] hover:underline"
                    >
                      Supabase 가입하러 가기
                      <div className="i-ph:arrow-square-out w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <StepBadge>2</StepBadge>
                  <div className="flex-1 space-y-2">
                    <h4 className="text-sm font-medium text-bolt-elements-textPrimary">프로젝트 만들기</h4>
                    <p className="text-sm text-bolt-elements-textSecondary">
                      로그인하면 나오는 화면에서 "New Project" 버튼을 눌러주세요. 비밀번호는 "Generate a password"
                      버튼으로 자동 생성하고, 지역(Region)은 가까운 곳으로 고르면 돼요. 만든 뒤엔 1~2분 정도 준비 시간이
                      필요해요.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <StepBadge>3</StepBadge>
                  <div className="flex-1 space-y-3">
                    <h4 className="text-sm font-medium text-bolt-elements-textPrimary">연결 승인</h4>
                    <p className="text-sm text-bolt-elements-textSecondary">
                      프로젝트 화면 왼쪽 메뉴에서 톱니바퀴 모양 "Project Settings" → "API Keys"를 눌러주세요. 거기 있는
                      "Project URL"과, "anon" "public" 또는 "publishable" 라벨이 붙은 키, 이 두 개를 아래에 복사해서
                      붙여넣으면 돼요.
                    </p>
                    <p className="text-xs text-bolt-elements-textTertiary">
                      "service_role" 또는 "secret"이라고 써있는 키는 절대 넣지 마세요 — 그건 이 앱과 공유하면 안 되는
                      키예요.
                    </p>

                    <div>
                      <label className="block text-xs text-bolt-elements-textSecondary mb-1">Project URL</label>
                      <input
                        type="text"
                        value={simpleUrl}
                        onChange={(e) => setSimpleUrl(e.target.value)}
                        disabled={simpleConnecting}
                        placeholder="https://xxxxxxxxxxxx.supabase.co"
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-bolt-elements-textSecondary mb-1">
                        anon / public / publishable key
                      </label>
                      <input
                        type="password"
                        value={simpleAnonKey}
                        onChange={(e) => setSimpleAnonKey(e.target.value)}
                        disabled={simpleConnecting}
                        placeholder="eyJhbGciOi..."
                        className={inputClassName}
                      />
                    </div>

                    {simpleConnectError && (
                      <p className="text-sm text-red-500 dark:text-red-400">{simpleConnectError}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <DialogClose asChild>
                    <DialogButton type="secondary">취소</DialogButton>
                  </DialogClose>
                  <button
                    onClick={handleWizardConnect}
                    disabled={simpleConnecting || !simpleUrl.trim() || !simpleAnonKey.trim()}
                    className={classNames(
                      'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                      'bg-[#3ECF8E] text-white',
                      'hover:bg-[#3BBF84]',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {simpleConnecting ? (
                      <>
                        <div className="i-ph:spinner-gap animate-spin" />
                        연결하는 중...
                      </>
                    ) : (
                      <>
                        <div className="i-ph:plug-charging w-4 h-4" />
                        연결하기
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : !isPatConnection ? (
              <div className="space-y-4">
                <DialogTitle>
                  <img
                    className="w-5 h-5"
                    height="24"
                    width="24"
                    crossOrigin="anonymous"
                    src="https://cdn.simpleicons.org/supabase"
                    alt=""
                  />
                  저장 기능
                </DialogTitle>

                <div className="flex items-center gap-3 p-3 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg">
                  <div className="i-ph:check-circle-fill w-5 h-5 text-[#3ECF8E] shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-bolt-elements-textPrimary">연결됐어요</h4>
                    <p className="text-xs text-bolt-elements-textSecondary truncate">
                      {supabaseConn.credentials?.supabaseUrl}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <DialogClose asChild>
                    <DialogButton type="secondary">닫기</DialogButton>
                  </DialogClose>
                  <DialogButton type="danger" onClick={handleDisconnect}>
                    <div className="i-ph:plugs w-4 h-4" />
                    연결 끊기
                  </DialogButton>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <DialogTitle>
                    <img
                      className="w-5 h-5"
                      height="24"
                      width="24"
                      crossOrigin="anonymous"
                      src="https://cdn.simpleicons.org/supabase"
                      alt=""
                    />
                    Supabase 연결
                  </DialogTitle>
                </div>

                <div className="flex items-center gap-4 p-3 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg">
                  <div>
                    <h4 className="text-sm font-medium text-bolt-elements-textPrimary">{supabaseConn.user?.email}</h4>
                    <p className="text-xs text-bolt-elements-textSecondary">권한: {supabaseConn.user?.role}</p>
                  </div>
                </div>

                {fetchingStats ? (
                  <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
                    <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                    프로젝트를 불러오는 중...
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                        className="bg-transparent text-left text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-2"
                      >
                        <div className="i-ph:database w-4 h-4" />내 프로젝트 ({supabaseConn.stats?.totalProjects || 0})
                        <div
                          className={classNames(
                            'i-ph:caret-down w-4 h-4 transition-transform',
                            isProjectsExpanded ? 'rotate-180' : '',
                          )}
                        />
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => fetchSupabaseStats(supabaseConn.token)}
                          className="px-2 py-1 rounded-md text-xs bg-[#F0F0F0] dark:bg-[#252525] text-bolt-elements-textSecondary hover:bg-[#E5E5E5] dark:hover:bg-[#333333] flex items-center gap-1"
                          title="프로젝트 목록 새로고침"
                        >
                          <div className="i-ph:arrows-clockwise w-3 h-3" />
                          새로고침
                        </button>
                        <button
                          onClick={() => handleCreateProject()}
                          className="px-2 py-1 rounded-md text-xs bg-[#3ECF8E] text-white hover:bg-[#3BBF84] flex items-center gap-1"
                        >
                          <div className="i-ph:plus w-3 h-3" />새 프로젝트
                        </button>
                      </div>
                    </div>

                    {isProjectsExpanded && (
                      <>
                        {!supabaseConn.selectedProjectId && (
                          <div className="mb-2 p-3 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg text-sm text-bolt-elements-textSecondary">
                            이 대화에서 사용할 프로젝트를 선택하거나 새로 만드세요
                          </div>
                        )}

                        {supabaseConn.stats?.projects?.length ? (
                          <div className="grid gap-2 max-h-60 overflow-y-auto">
                            {supabaseConn.stats.projects.map((project) => (
                              <div
                                key={project.id}
                                className="block p-3 rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-[#3ECF8E] dark:hover:border-[#3ECF8E] transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h5 className="text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-1">
                                      <div className="i-ph:database w-3 h-3 text-[#3ECF8E]" />
                                      {project.name}
                                    </h5>
                                    <div className="text-xs text-bolt-elements-textSecondary mt-1">
                                      {project.region}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => selectProject(project.id)}
                                    className={classNames(
                                      'px-3 py-1 rounded-md text-xs',
                                      supabaseConn.selectedProjectId === project.id
                                        ? 'bg-[#3ECF8E] text-white'
                                        : 'bg-[#F0F0F0] dark:bg-[#252525] text-bolt-elements-textSecondary hover:bg-[#3ECF8E] hover:text-white',
                                    )}
                                  >
                                    {supabaseConn.selectedProjectId === project.id ? (
                                      <span className="flex items-center gap-1">
                                        <div className="i-ph:check w-3 h-3" />
                                        선택됨
                                      </span>
                                    ) : (
                                      '선택'
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-bolt-elements-textSecondary flex items-center gap-2">
                            <div className="i-ph:info w-4 h-4" />
                            프로젝트가 없어요
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <DialogClose asChild>
                    <DialogButton type="secondary">닫기</DialogButton>
                  </DialogClose>
                  <DialogButton type="danger" onClick={handleDisconnect}>
                    <div className="i-ph:plugs w-4 h-4" />
                    연결 끊기
                  </DialogButton>
                </div>
              </div>
            )}
          </Dialog>
        )}
      </DialogRoot>
    </div>
  );
}

function StepBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-6 h-6 rounded-full bg-[#3ECF8E] text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
      {children}
    </div>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
  className?: string;
  title?: string;
}

function Button({ active = false, disabled = false, children, onClick, className, title }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center p-1.5',
        {
          'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary':
            !active,
          'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentAccent': active && !disabled,
          'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed':
            disabled,
        },
        className,
      )}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
