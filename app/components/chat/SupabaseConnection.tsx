import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useSupabaseConnection } from '~/lib/hooks/useSupabaseConnection';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { chatId } from '~/lib/persistence/useChatHistory';
import { fetchSupabaseStats } from '~/lib/stores/supabase';
import { Dialog, DialogRoot, DialogClose, DialogTitle, DialogButton } from '~/components/ui/Dialog';
import { isOpenSupabaseConnectionMessage } from '~/lib/supabase/previewBridge';
import { authUserStore } from '~/lib/stores/auth';
import { platformSupabase } from '~/lib/supabase/platform-client';
import { cloudAppState, loadCloudAppForChat, saveCloudAppForChat, clearCloudAppForChat } from '~/lib/stores/cloud';

interface SupabaseConnectionProps {
  showLabel?: boolean;
}

const inputClassName = classNames(
  'w-full px-3 py-2 rounded-lg text-sm',
  'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
  'border border-[#E5E5E5] dark:border-[#333333]',
  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
  'focus:outline-none focus:ring-1 focus:ring-[var(--accent)]',
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
  const [showAdvancedWizard, setShowAdvancedWizard] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  const currentChatId = useStore(chatId);
  const authUser = useStore(authUserStore);
  const cloudApp = useStore(cloudAppState);

  const isCloudOn = !!cloudApp;
  const isStorageOn = isConnected || isCloudOn;

  useEffect(() => {
    cloudAppState.set(currentChatId ? loadCloudAppForChat(currentChatId) : null);
  }, [currentChatId]);

  const handleTurnOnCloud = async () => {
    if (!currentChatId) {
      return;
    }

    if (!authUser) {
      window.location.href = '/login';
      return;
    }

    if (!platformSupabase) {
      toast.error('저장 기능을 켜지 못했어요. 잠시 후 다시 시도해주세요.');
      return;
    }

    setProvisioning(true);

    try {
      const {
        data: { session },
      } = await platformSupabase.auth.getSession();

      const response = await fetch('/api/cloud-provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
      });

      const data = (await response.json()) as {
        appId?: string;
        token?: string;
        expiresAt?: string;
        error?: string;
      };

      if (!response.ok || !data.appId || !data.token) {
        toast.error(data.error || '저장 기능을 켜지 못했어요. 잠시 후 다시 시도해주세요.');
        return;
      }

      saveCloudAppForChat(currentChatId, { appId: data.appId, token: data.token, expiresAt: data.expiresAt ?? null });
      toast.success('저장 기능이 켜졌어요');
    } catch {
      toast.error('저장 기능을 켜지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setProvisioning(false);
    }
  };

  const handleClearCloud = () => {
    if (!currentChatId) {
      return;
    }

    clearCloudAppForChat(currentChatId);
    toast.success('저장 기능 연결 정보를 지웠어요');
  };

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
            'hover:bg-bolt-elements-item-backgroundActive flex items-center gap-2 whitespace-nowrap',
            {
              '!px-2': !showLabel,
            },
          )}
          title={isStorageOn ? '저장 기능이 켜졌어요' : '앱에 로그인과 저장 기능을 쓰려면 연결이 필요해요'}
        >
          <div className="i-ph:database w-4 h-4 shrink-0 text-[var(--accent)]" />
          {showLabel && <span className="ml-1 text-xs">{isStorageOn ? '저장 기능 켜짐' : '저장 기능 켜기'}</span>}
        </Button>
      </div>

      <DialogRoot
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);

          if (!open) {
            setShowAdvancedWizard(false);
          }
        }}
      >
        {isDialogOpen && (
          <Dialog className="max-w-[520px] p-6">
            {!isStorageOn && !showAdvancedWizard ? (
              <div className="space-y-5">
                <DialogTitle>
                  <div className="i-ph:database w-5 h-5 text-[var(--accent)]" />
                  저장 기능 켜기
                </DialogTitle>
                <p className="text-sm text-bolt-elements-textSecondary -mt-3">
                  회원가입, 목록 저장처럼 데이터가 남아야 하는 기능을 쓰려면 저장 기능을 켜야 해요. 둘 중 하나를
                  골라주세요.
                </p>

                <button
                  type="button"
                  onClick={handleTurnOnCloud}
                  disabled={provisioning}
                  className={classNames(
                    'w-full text-left p-4 rounded-lg border border-[var(--accent)] flex items-center gap-3',
                    'bg-[var(--accent-soft)] hover:bg-[var(--accent-ring)] transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <div
                    className={classNames(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                      'bg-[var(--accent)] text-[var(--on-accent)]',
                    )}
                  >
                    {provisioning ? (
                      <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                    ) : (
                      <div className="i-ph:lightning-fill w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-bolt-elements-textPrimary">
                      코랄레드로 바로 켜기 <span className="text-[var(--accent-text)]">(추천)</span>
                    </h4>
                    <p className="text-xs text-bolt-elements-textSecondary">
                      가입도 키 복사도 없이 한 번에 켜져요. 체험용이라 7일 뒤 데이터가 정리돼요 — 계속 쓰려면 요금제를
                      확인해주세요.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAdvancedWizard(true)}
                  className="w-full text-left p-4 rounded-lg border border-bolt-elements-borderColor hover:bg-bolt-elements-item-backgroundActive transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-bolt-elements-background-depth-3">
                    <div className="i-ph:gear-six w-4 h-4 text-bolt-elements-textSecondary" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-bolt-elements-textPrimary">내 Supabase 연결 (고급)</h4>
                    <p className="text-xs text-bolt-elements-textSecondary">
                      직접 만든 Supabase 프로젝트를 연결해요. 데이터가 계속 남고, 여러 기기에서 로그인하는 구조도 만들
                      수 있어요.
                    </p>
                  </div>
                </button>

                <div className="flex justify-end pt-1">
                  <DialogClose asChild>
                    <DialogButton type="secondary">취소</DialogButton>
                  </DialogClose>
                </div>
              </div>
            ) : isCloudOn && !isConnected ? (
              <div className="space-y-4">
                <DialogTitle>
                  <div className="i-ph:database w-5 h-5 text-[var(--accent)]" />
                  저장 기능
                </DialogTitle>

                <div className="flex items-center gap-3 p-3 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg">
                  <div className="i-ph:check-circle-fill w-5 h-5 text-bolt-elements-icon-success shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-bolt-elements-textPrimary">
                      코랄레드 저장 기능이 켜졌어요
                    </h4>
                    <p className="text-xs text-bolt-elements-textSecondary">
                      체험용이라 7일 뒤 데이터가 정리돼요. 계속 쓰려면 요금제를 확인해주세요.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <DialogClose asChild>
                    <DialogButton type="secondary">닫기</DialogButton>
                  </DialogClose>
                  <DialogButton type="danger" onClick={handleClearCloud}>
                    <div className="i-ph:plugs w-4 h-4" />
                    연결 정보 지우기
                  </DialogButton>
                </div>
              </div>
            ) : showAdvancedWizard && !isConnected ? (
              <div className="space-y-5">
                <DialogTitle>
                  <div className="i-ph:database w-5 h-5 text-[var(--accent)]" />
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
                      className="inline-flex items-center gap-1 text-sm text-[var(--accent-text)] hover:underline"
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
                  <DialogButton type="secondary" onClick={() => setShowAdvancedWizard(false)}>
                    뒤로
                  </DialogButton>
                  <button
                    onClick={handleWizardConnect}
                    disabled={simpleConnecting || !simpleUrl.trim() || !simpleAnonKey.trim()}
                    className={classNames(
                      'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                      'bg-[var(--accent)] text-[var(--on-accent)]',
                      'hover:bg-[var(--accent-hover)]',
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
                  <div className="i-ph:database w-5 h-5 text-[var(--accent)]" />
                  저장 기능
                </DialogTitle>

                <div className="flex items-center gap-3 p-3 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg">
                  <div className="i-ph:check-circle-fill w-5 h-5 text-bolt-elements-icon-success shrink-0" />
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
                    <div className="i-ph:database w-5 h-5 text-[var(--accent)]" />
                    저장 기능
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
                          className="px-2 py-1 rounded-md text-xs bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-hover)] flex items-center gap-1"
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
                                className="block p-3 rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-[var(--accent)] dark:hover:border-[var(--accent)] transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h5 className="text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-1">
                                      <div className="i-ph:database w-3 h-3 text-[var(--accent)]" />
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
                                        ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                                        : 'bg-[#F0F0F0] dark:bg-[#252525] text-bolt-elements-textSecondary hover:bg-[var(--accent)] hover:text-[var(--on-accent)]',
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
    <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
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
