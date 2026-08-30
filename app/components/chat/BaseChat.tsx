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
import { chatStore } from '~/lib/stores/chat';
import { useStore } from '@nanostores/react';
import { StickToBottom, useStickToBottomContext } from '~/lib/hooks';
import { ChatBox } from './ChatBox';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import LlmErrorAlert from './LLMApiAlert';
import PromptClarification from './PromptClarification';
import type { GenerationDirectives } from '~/lib/onboarding/answer-directives';
import { DeployedAppCards } from './DeployedAppCards';
import useViewport from '~/lib/hooks';
import homeStyles from './ChatHome.module.scss';

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

/*
 * Lazy-loaded for the same reason as Workbench above: MobileWorkspace imports Preview, which pulls
 * in the same heavy workbenchStore graph. Only ever mounted once isSmallViewport && chatStarted are
 * both true (client-side only), so deferring it keeps that cost out of the initial bundle for
 * everyone else, same as Workbench already does for desktop.
 */
const MobileWorkspace = lazy(() => import('./MobileWorkspace').then((module) => ({ default: module.MobileWorkspace })));

const TEXTAREA_MIN_HEIGHT = 76;

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
  onRetryLlmError?: () => void;
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
      onRetryLlmError,
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
    const isSmallViewport = useViewport(1024);
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
    const { workbenchOpen } = useStore(chatStore);

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

    const chatColumnContent = clarifyingPrompt ? (
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
                  /*
                   * 채팅 화면 재설계 — 말풍선 시절의 max-w-chat(528px)은 AI 응답의 새 640px
                   * 상한보다 좁아서 그 값이 절대 안 걸린다. 턴 선의 16px padding까지 감안해 이
                   * 칼럼만 별도로 넓힌다(입력창 등 다른 max-w-chat 소비처는 그대로 둠).
                   */
                  return chatStarted ? (
                    <Messages
                      className="flex flex-col w-full flex-1 max-w-[680px] pb-4 mx-auto z-1"
                      messages={messages}
                      parsedMessages={parsedMessages}
                      isStreaming={isStreaming}
                      hasError={!!llmErrorAlert}
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
                    <LlmErrorAlert
                      alert={llmErrorAlert}
                      clearAlert={() => clearLlmErrorAlert?.()}
                      onRetry={onRetryLlmError}
                    />
                  )}
                </div>
                {progressAnnotations && <ProgressCompilation data={progressAnnotations} />}
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
                'flex flex-col items-center px-4 pb-16': !chatStarted,
                'h-full flex flex-col min-h-0': chatStarted,
              })}
              style={!chatStarted ? { background: '#FBF5EE', minHeight: '88vh' } : undefined}
            >
              <div
                className={classNames('flex flex-col min-w-0 relative z-10 w-full', {
                  'h-full min-h-0': chatStarted,
                })}
              >
                {!chatStarted ? (
                  <div className="w-full flex flex-col items-center">
                    <div className={homeStyles.stage}>
                      <div className={homeStyles.stageBlock}>
                        <div className="w-full mx-auto flex flex-col items-center" style={{ maxWidth: 760 }}>
                          <p className={homeStyles.greeting}>오늘은 뭘 만들어볼까요?</p>
                          <StickToBottom className="relative w-full" resize="smooth" initial="smooth">
                            {chatBoxSection}
                          </StickToBottom>
                        </div>
                      </div>
                    </div>
                    <ClientOnly>{() => <DeployedAppCards />}</ClientOnly>
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
            </div>
          );
        })()}
      </>
    );

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        {chatStarted && isSmallViewport ? (
          <ClientOnly>
            {() => (
              <Suspense fallback={null}>
                <MobileWorkspace chatColumnContent={chatColumnContent} setSelectedElement={setSelectedElement} />
              </Suspense>
            )}
          </ClientOnly>
        ) : (
          <div className={classNames(styles.ChatArea, 'flex flex-col lg:flex-row overflow-y-auto w-full h-full')}>
            {/*
              채팅 홈·생성 전환 통합 수정 — 워크벤치가 열리는 순간(workbenchOpen) flex-grow를 즉시
              끄고 최종 폭(--chat-min-width)으로 고정한다. flex-grow를 계속 켜둔 채로 형제
              워크벤치가 폭 0→--workbench-width로 애니메이션되면 매 프레임 flexbox가 이 칼럼의
              폭을 다시 계산해서 대화 텍스트가 리플로우로 계속 튄다 — 폭을 먼저 고정해두면
              워크벤치만 움직이고 이 칼럼은 그대로라 리플로우가 없다.
            */}
            <div
              className={classNames(styles.Chat, 'flex flex-col h-full', {
                'flex-grow lg:min-w-[var(--chat-min-width)]': !workbenchOpen,
                'flex-none lg:w-[var(--chat-min-width)]': workbenchOpen,
              })}
            >
              {chatColumnContent}
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
        )}
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
