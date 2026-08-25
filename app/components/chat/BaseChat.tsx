/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import type { JSONValue, UIMessage } from 'ai';
import React, { type RefCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST, SHOW_DEV_TOOLS } from '~/utils/constants';
import { Messages } from './Messages.client';
import { getApiKeysFromCookies } from './APIKeyManager';
import Cookies from 'js-cookie';
import * as Tooltip from '@radix-ui/react-tooltip';
import styles from './BaseChat.module.scss';
import { ImportButtons } from '~/components/chat/chatExportAndImport/ImportButtons';
import GitCloneButton from './GitCloneButton';
import type { ProviderInfo } from '~/types/model';
import StarterTemplates from './StarterTemplates';
import type { ActionAlert, SupabaseAlert, DeployAlert, LlmErrorAlertType } from '~/types/actions';
import DeployChatAlert from '~/components/deploy/DeployAlert';
import ChatAlert from './ChatAlert';
import type { ModelInfo } from '~/lib/modules/llm/types';
import ProgressCompilation from './ProgressCompilation';
import type { ProgressAnnotation } from '~/types/context';
import { SupabaseChatAlert } from '~/components/chat/SupabaseAlert';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
import { useStore } from '@nanostores/react';
import { StickToBottom, useStickToBottomContext } from '~/lib/hooks';
import { ChatBox } from './ChatBox';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import LlmErrorAlert from './LLMApiAlert';
import { getGenerationsRemaining } from '~/lib/freeTrial';
import { createScopedLogger } from '~/utils/logger';
import { authUserStore } from '~/lib/stores/auth';
import PromptClarification from './PromptClarification';
import type { GenerationDirectives } from '~/lib/onboarding/answer-directives';
import { CoralredHero } from '~/components/landing/CoralredHero';
import { ScrollHint } from '~/components/landing/ScrollHint';
import { Logo } from '~/components/ui/Logo';

/*
 * Lazy-loaded: Workbench.client.tsx pulls in the workbenchStore singleton (ActionRunner,
 * EditorStore, FilesStore, PreviewsStore, TerminalStore, JSZip, Octokit, the WebContainer
 * bootstrap). BaseChat renders unconditionally on the main chat route and previously imported
 * this statically, so that whole graph loaded on first paint regardless of whether the workbench
 * was ever opened — this was the dominant contributor to the ~1MB gzipped shared chunk (lazy-
 * loading Header's own, much smaller, import of the same store barely moved that number, since
 * this import alone already forced the bundle eagerly).
 */
const Workbench = lazy(() =>
  import('~/components/workbench/Workbench.client').then((module) => ({ default: module.Workbench })),
);

const TEXTAREA_MIN_HEIGHT = 76;

const logger = createScopedLogger('BaseChat');

const LANDING_STEPS = [
  { number: '01', title: '말해요', description: '만들고 싶은 걸 한국어로 설명해요' },
  { number: '02', title: '만들어져요', description: 'AI가 화면과 기능을 전부 만들어요' },
  { number: '03', title: '바로 써요', description: '주소가 생기고, 링크로 공유할 수 있어요' },
];

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  clarifyingPrompt?: string | null;
  onClarificationComplete?: (finalPrompt: string, directives: GenerationDirectives) => void;
  isStreaming?: boolean;
  onStreamingChange?: (streaming: boolean) => void;
  messages?: UIMessage[];
  parsedMessages?: { [key: number]: string };
  description?: string;
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  providerList?: ProviderInfo[];
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  importChat?: (description: string, messages: UIMessage[]) => Promise<void>;
  exportChat?: () => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
  actionAlert?: ActionAlert;
  clearAlert?: () => void;
  supabaseAlert?: SupabaseAlert;
  clearSupabaseAlert?: () => void;
  deployAlert?: DeployAlert;
  clearDeployAlert?: () => void;
  llmErrorAlert?: LlmErrorAlertType;
  clearLlmErrorAlert?: () => void;
  data?: JSONValue[] | undefined;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  append?: (message: { text: string }) => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: (element: ElementInfo | null) => void;
  addToolOutput?: (input: {
    state?: 'output-available';
    tool: string;
    toolCallId: string;
    output: any;
    errorText?: never;
  }) => void;
  onWebSearchResult?: (result: string) => void;
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      showChat = true,
      chatStarted = false,
      clarifyingPrompt = null,
      onClarificationComplete,
      isStreaming = false,
      onStreamingChange,
      model,
      setModel,
      provider,
      setProvider,
      providerList,
      input = '',
      enhancingPrompt,
      handleInputChange,

      // promptEnhanced,
      enhancePrompt,
      sendMessage,
      handleStop,
      importChat,
      exportChat,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      messages,
      parsedMessages,
      actionAlert,
      clearAlert,
      deployAlert,
      clearDeployAlert,
      supabaseAlert,
      clearSupabaseAlert,
      llmErrorAlert,
      clearLlmErrorAlert,
      data,
      chatMode,
      setChatMode,
      append,
      designScheme,
      setDesignScheme,
      selectedElement,
      setSelectedElement,
      addToolOutput = () => {
        throw new Error('addToolOutput not implemented');
      },
      onWebSearchResult,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const authUser = useStore(authUserStore);
    const [freeGenerationsRemaining, setFreeGenerationsRemaining] = useState<number | null>(null);

    useEffect(() => {
      let cancelled = false;

      getGenerationsRemaining()
        .then((remaining) => {
          if (!cancelled) {
            setFreeGenerationsRemaining(remaining);
          }
        })
        .catch((error) => {
          // Leave freeGenerationsRemaining as null (unknown) rather than showing "0 left" on a transient error.
          logger.error('Failed to load free generation count', error);
        });

      return () => {
        cancelled = true;
      };
    }, [authUser]);

    const [apiKeys, setApiKeys] = useState<Record<string, string>>(getApiKeysFromCookies());
    const [modelList, setModelList] = useState<ModelInfo[]>([]);
    const [isModelSettingsCollapsed, setIsModelSettingsCollapsed] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState('');
    const voiceBaseTextRef = useRef('');
    const [isModelLoading, setIsModelLoading] = useState<string | undefined>('all');
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
    const expoUrl = useStore(expoUrlAtom);
    const [qrModalOpen, setQrModalOpen] = useState(false);

    useEffect(() => {
      if (expoUrl) {
        setQrModalOpen(true);
      }
    }, [expoUrl]);

    useEffect(() => {
      if (data) {
        const progressList = data.filter(
          (x) => typeof x === 'object' && (x as any).type === 'progress',
        ) as ProgressAnnotation[];
        setProgressAnnotations(progressList);
      }
    }, [data]);
    useEffect(() => {
      console.log(transcript);
    }, [transcript]);

    useEffect(() => {
      onStreamingChange?.(isStreaming);
    }, [isStreaming, onStreamingChange]);

    useEffect(() => {
      if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        /*
         * Korean-only service — relying on the browser/OS locale caused garbled recognition for
         * Korean speech whenever that locale wasn't already ko-KR.
         */
        recognition.lang = 'ko-KR';

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0])
            .map((result) => result.transcript)
            .join('');

          setTranscript(transcript);

          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: voiceBaseTextRef.current + transcript },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        setRecognition(recognition);
      }
    }, []);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        let parsedApiKeys: Record<string, string> | undefined = {};

        try {
          parsedApiKeys = getApiKeysFromCookies();
          setApiKeys(parsedApiKeys);
        } catch (error) {
          console.error('Error loading API keys from cookies:', error);
          Cookies.remove('apiKeys');
        }

        setIsModelLoading('all');
        fetch('/api/models')
          .then((response) => response.json())
          .then((data) => {
            const typedData = data as { modelList: ModelInfo[] };
            setModelList(typedData.modelList);
          })
          .catch((error) => {
            console.error('Error fetching model list:', error);
          })
          .finally(() => {
            setIsModelLoading(undefined);
          });
      }
    }, [providerList, provider]);

    const onApiKeysChange = async (providerName: string, apiKey: string) => {
      const newApiKeys = { ...apiKeys, [providerName]: apiKey };
      setApiKeys(newApiKeys);
      Cookies.set('apiKeys', JSON.stringify(newApiKeys));

      setIsModelLoading(providerName);

      let providerModels: ModelInfo[] = [];

      try {
        const response = await fetch(`/api/models/${encodeURIComponent(providerName)}`);
        const data = await response.json();
        providerModels = (data as { modelList: ModelInfo[] }).modelList;
      } catch (error) {
        console.error('Error loading dynamic models for:', providerName, error);
      }

      // Only update models for the specific provider
      setModelList((prevModels) => {
        const otherModels = prevModels.filter((model) => model.provider !== providerName);
        return [...otherModels, ...providerModels];
      });
      setIsModelLoading(undefined);
    };

    const startListening = () => {
      if (recognition) {
        voiceBaseTextRef.current = input ? `${input} ` : '';
        recognition.start();
        setIsListening(true);
      }
    };

    const stopListening = () => {
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
    };

    const handleSendMessage = (event: React.UIEvent, messageInput?: string) => {
      if (sendMessage) {
        sendMessage(event, messageInput);
        setSelectedElement?.(null);

        if (recognition) {
          recognition.abort(); // Stop current recognition
          setTranscript(''); // Clear transcript
          voiceBaseTextRef.current = '';
          setIsListening(false);

          // Clear the input by triggering handleInputChange with empty value
          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: '' },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        }
      }
    };

    const handleFileUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (file) {
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setUploadedFiles?.([...uploadedFiles, file]);
            setImageDataList?.([...imageDataList, base64Image]);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFiles?.([...uploadedFiles, file]);
              setImageDataList?.([...imageDataList, base64Image]);
            };
            reader.readAsDataURL(file);
          }

          break;
        }
      }
    };

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div className="flex flex-col lg:flex-row overflow-y-auto w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow lg:min-w-[var(--chat-min-width)] h-full')}>
            {clarifyingPrompt ? (
              <PromptClarification
                initialPrompt={clarifyingPrompt}
                onComplete={(finalPrompt, directives) => onClarificationComplete?.(finalPrompt, directives)}
              />
            ) : (
              <>
                {(() => {
                  /*
                   * Shared between both branches below so the alerts/progress/free-trial-notice/
                   * ChatBox wiring (30+ props) isn't duplicated — only the surrounding chrome
                   * (headline, card centering, StickToBottom's own className) differs by state.
                   *
                   * Split into messagesSection/inputSection (rather than one combined chunk) so the
                   * chatStarted branch below can give messagesSection its own bounded, independently
                   * scrolling box while inputSection sits outside it as a plain flex sibling — see the
                   * chatStarted ternary a bit further down for why (input bar reachability fix).
                   */
                  const messagesSection = (
                    <StickToBottom.Content className="flex flex-col gap-4 relative ">
                      <ClientOnly>
                        {() => {
                          return chatStarted ? (
                            <Messages
                              className="flex flex-col w-full flex-1 max-w-chat pb-4 mx-auto z-1"
                              messages={messages}
                              parsedMessages={parsedMessages}
                              isStreaming={isStreaming}
                              append={append}
                              chatMode={chatMode}
                              setChatMode={setChatMode}
                              provider={provider}
                              model={model}
                              addToolOutput={addToolOutput}
                            />
                          ) : null;
                        }}
                      </ClientOnly>
                      <ScrollToBottom />
                    </StickToBottom.Content>
                  );

                  const inputSection = (
                    <>
                      <div
                        className={classNames('flex flex-col gap-2 w-full max-w-chat mx-auto z-prompt mb-6', {
                          'my-auto': !chatStarted,
                          'flex-shrink-0 mt-2': chatStarted,
                        })}
                      >
                        <div className="flex flex-col gap-2">
                          {deployAlert && (
                            <DeployChatAlert
                              alert={deployAlert}
                              clearAlert={() => clearDeployAlert?.()}
                              postMessage={(message: string | undefined) => {
                                sendMessage?.({} as any, message);
                                clearSupabaseAlert?.();
                              }}
                            />
                          )}
                          {supabaseAlert && (
                            <SupabaseChatAlert
                              alert={supabaseAlert}
                              clearAlert={() => clearSupabaseAlert?.()}
                              postMessage={(message) => {
                                sendMessage?.({} as any, message);
                                clearSupabaseAlert?.();
                              }}
                            />
                          )}
                          {actionAlert && (
                            <ChatAlert
                              alert={actionAlert}
                              clearAlert={() => clearAlert?.()}
                              postMessage={(message) => {
                                sendMessage?.({} as any, message);
                                clearAlert?.();
                              }}
                            />
                          )}
                          {llmErrorAlert && (
                            <LlmErrorAlert alert={llmErrorAlert} clearAlert={() => clearLlmErrorAlert?.()} />
                          )}
                        </div>
                        {progressAnnotations && <ProgressCompilation data={progressAnnotations} />}
                        {freeGenerationsRemaining !== null && (
                          <p
                            className={classNames('text-xs px-1', { 'text-right': !chatStarted })}
                            style={{ color: '#FAF7F0', opacity: 0.75, display: chatStarted ? 'none' : undefined }}
                          >
                            {freeGenerationsRemaining > 0 ? (
                              <span key="remaining">
                                {authUser ? '무료 생성' : '무료 체험'} {freeGenerationsRemaining}회 남았어요
                              </span>
                            ) : (
                              <span key="exhausted">
                                {authUser ? '무료 생성 횟수를 모두 사용했어요' : '무료 체험을 다 썼어요'}. 계속하려면{' '}
                                <a href="/pricing" style={{ color: '#FAF7F0', textDecoration: 'underline' }}>
                                  요금제
                                </a>
                                를 확인해주세요
                              </span>
                            )}
                          </p>
                        )}
                        <ChatBox
                          isModelSettingsCollapsed={isModelSettingsCollapsed}
                          setIsModelSettingsCollapsed={setIsModelSettingsCollapsed}
                          provider={provider}
                          setProvider={setProvider}
                          providerList={providerList || (PROVIDER_LIST as ProviderInfo[])}
                          model={model}
                          setModel={setModel}
                          modelList={modelList}
                          apiKeys={apiKeys}
                          isModelLoading={isModelLoading}
                          onApiKeysChange={onApiKeysChange}
                          uploadedFiles={uploadedFiles}
                          setUploadedFiles={setUploadedFiles}
                          imageDataList={imageDataList}
                          setImageDataList={setImageDataList}
                          textareaRef={textareaRef}
                          input={input}
                          handleInputChange={handleInputChange}
                          handlePaste={handlePaste}
                          TEXTAREA_MIN_HEIGHT={TEXTAREA_MIN_HEIGHT}
                          TEXTAREA_MAX_HEIGHT={TEXTAREA_MAX_HEIGHT}
                          isStreaming={isStreaming}
                          handleStop={handleStop}
                          handleSendMessage={handleSendMessage}
                          enhancingPrompt={enhancingPrompt}
                          enhancePrompt={enhancePrompt}
                          isListening={isListening}
                          speechRecognitionSupported={recognition !== null}
                          startListening={startListening}
                          stopListening={stopListening}
                          chatStarted={chatStarted}
                          exportChat={exportChat}
                          qrModalOpen={qrModalOpen}
                          setQrModalOpen={setQrModalOpen}
                          handleFileUpload={handleFileUpload}
                          chatMode={chatMode}
                          setChatMode={setChatMode}
                          designScheme={designScheme}
                          setDesignScheme={setDesignScheme}
                          selectedElement={selectedElement}
                          setSelectedElement={setSelectedElement}
                          onWebSearchResult={onWebSearchResult}
                          isLanding={!chatStarted}
                        />
                      </div>
                    </>
                  );

                  // Only the !chatStarted (landing) branch needs the two pieces glued back together.
                  const chatBoxSection = (
                    <>
                      {messagesSection}
                      {inputSection}
                    </>
                  );

                  return (
                    <div
                      className={classNames('relative overflow-hidden', {
                        'flex flex-col items-center justify-center px-4 py-16': !chatStarted,
                        'h-full flex flex-col min-h-0': chatStarted,
                      })}
                      style={!chatStarted ? { background: '#FF5330', minHeight: '88vh' } : undefined}
                    >
                      {!chatStarted && (
                        <ClientOnly>
                          {() => <CoralredHero onFocusPrompt={() => textareaRef?.current?.focus()} />}
                        </ClientOnly>
                      )}
                      <div
                        className={classNames('flex flex-col min-w-0 relative z-10 w-full', {
                          'h-full min-h-0': chatStarted,
                        })}
                      >
                        {!chatStarted ? (
                          <div className="w-full mx-auto flex flex-col items-center" style={{ maxWidth: 760 }}>
                            <div id="intro" className="flex flex-col items-center text-center mb-7 animate-fade-in">
                              <Logo variant="onCoral" height={28} />
                              <h1
                                className="mt-6"
                                style={{
                                  color: '#FAF7F0',
                                  fontWeight: 800,
                                  letterSpacing: '-0.02em',
                                  fontSize: 'clamp(30px, 4.2vw, 44px)',
                                  lineHeight: 1.15,
                                }}
                              >
                                오늘 뭘 만들까요?
                              </h1>
                            </div>
                            <StickToBottom className="relative w-full" resize="smooth" initial="smooth">
                              {chatBoxSection}
                            </StickToBottom>
                            <p
                              className="text-center mt-4 animate-fade-in animation-delay-200"
                              style={{ color: 'rgba(250, 247, 240, 0.7)', fontSize: 13 }}
                            >
                              코딩 없이, 한국어로 설명하면 앱이 완성돼요
                            </p>
                          </div>
                        ) : (
                          <div className="relative h-full flex flex-col min-h-0">
                            {/*
                              messagesSection gets its own bounded (flex-1 min-h-0) box so it — and
                              only it — scrolls; inputSection sits outside as a flex-shrink-0
                              sibling, so it's always on screen instead of relying on `position:
                              sticky` inside an ancestor that (further up) has `overflow-hidden` for
                              the landing hero's decorative tiles. Sticky's containing block would
                              resolve to that non-scrolling ancestor and never engage, so the bar
                              just scrolled away with the messages — this is the fix for that.
                            */}
                            <StickToBottom
                              className="flex-1 min-h-0 flex flex-col pt-6 px-2 sm:px-6 modern-scrollbar"
                              resize="smooth"
                              initial="smooth"
                            >
                              {messagesSection}
                            </StickToBottom>
                            {inputSection}
                          </div>
                        )}
                        <div className="flex flex-col justify-center">
                          {!chatStarted && SHOW_DEV_TOOLS && (
                            <div className="flex justify-center gap-2">
                              {ImportButtons(importChat)}
                              <GitCloneButton importChat={importChat} />
                            </div>
                          )}
                          <div className="flex flex-col gap-5">
                            {/*
                              ExamplePrompts (suggestion chips) intentionally not rendered on the
                              landing hero — component kept intact for possible reuse elsewhere later.
                            */}
                            {!chatStarted && SHOW_DEV_TOOLS && <StarterTemplates />}
                          </div>
                        </div>
                      </div>
                      {!chatStarted && <ScrollHint />}
                    </div>
                  );
                })()}
                {!chatStarted && (
                  <section style={{ background: 'var(--bg)', padding: '140px 0' }}>
                    <div className="max-w-[1120px] mx-auto px-8">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {LANDING_STEPS.map((step) => (
                          <div
                            key={step.title}
                            className="flex flex-col gap-3 p-6 rounded-2xl transition-transform duration-150 ease-out hover:-translate-y-0.5"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                          >
                            <span
                              className="flex items-center justify-center"
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 14,
                                background: 'var(--accent)',
                                color: 'var(--on-accent)',
                                fontSize: 18,
                                fontWeight: 700,
                              }}
                            >
                              {step.number}
                            </span>
                            <h3 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 600 }}>{step.title}</h3>
                            <p style={{ color: 'var(--muted)', fontSize: 15 }}>{step.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* 쇼케이스 섹션(만든 앱 스크린샷) 자리 — 스크린샷 준비되면 3단계 섹션과 요금제 티저 사이에 추가 */}

                {!chatStarted && (
                  <section style={{ background: '#FF5330', padding: '96px 0' }}>
                    <div className="max-w-[1120px] mx-auto px-8 text-center">
                      <p style={{ color: '#FAF7F0', fontSize: 20, fontWeight: 600, marginBottom: 24 }}>
                        무료로 시작해서, 필요할 때 올려요
                      </p>
                      <a
                        href="/pricing"
                        className="inline-flex items-center justify-center rounded-md px-4 transition-opacity duration-150 hover:opacity-90 active:opacity-80"
                        style={{
                          height: 36,
                          background: '#FAF7F0',
                          color: '#FF5330',
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        요금제 보기
                      </a>
                    </div>
                  </section>
                )}

                {!chatStarted && (
                  <footer className="px-4 lg:px-10 py-6 border-t border-bolt-elements-borderColor text-xs text-bolt-elements-textTertiary flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                    <span>코랄레드</span>
                    <span>·</span>
                    <span>대표 한성민</span>
                    <span>·</span>
                    <span>사업자등록번호 383-23-02498</span>
                    <span>·</span>
                    <span>coralred@coralred.kr</span>
                    <span>·</span>
                    <a
                      href="/pricing"
                      className="text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:underline"
                    >
                      요금제
                    </a>
                    <span>·</span>
                    <a
                      href="/terms"
                      className="text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:underline"
                    >
                      이용약관
                    </a>
                    <span>·</span>
                    <a
                      href="/privacy"
                      className="text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:underline"
                    >
                      개인정보처리방침
                    </a>
                  </footer>
                )}
              </>
            )}
          </div>
          <ClientOnly>
            {() => (
              <Suspense fallback={null}>
                <Workbench
                  chatStarted={chatStarted}
                  isStreaming={isStreaming}
                  setSelectedElement={setSelectedElement}
                  messages={messages}
                />
              </Suspense>
            )}
          </ClientOnly>
        </div>
      </div>
    );

    return <Tooltip.Provider delayDuration={200}>{baseChat}</Tooltip.Provider>;
  },
);

function ScrollToBottom() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    !isAtBottom && (
      <>
        <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-bolt-elements-background-depth-1 to-transparent h-20 z-10" />
        <button
          className="sticky z-50 bottom-0 left-0 right-0 text-4xl rounded-lg px-1.5 py-0.5 flex items-center justify-center mx-auto gap-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm"
          onClick={() => scrollToBottom()}
        >
          마지막 메시지로 이동
          <span className="i-ph:arrow-down animate-bounce" />
        </button>
      </>
    )
  );
}
