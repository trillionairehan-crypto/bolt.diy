import { useStore } from '@nanostores/react';
import type { UIMessage, FileUIPart } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts } from '~/lib/hooks';
import { description, useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  PROMPT_COOKIE_KEY,
  PROVIDER_LIST,
  SHOW_DEV_TOOLS,
  CORALRED_NEW_METERING,
} from '~/utils/constants';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';
import Cookies from 'js-cookie';
import { debounce } from '~/utils/debounce';
import { useSettings } from '~/lib/hooks/useSettings';
import type { ProviderInfo } from '~/types/model';
import { useSearchParams } from '@remix-run/react';
import { createSampler } from '~/utils/sampler';
import { getTemplates, getBaselineTemplate, selectStarterTemplate } from '~/utils/selectStarterTemplate';
import { designSchemeToHue } from '~/utils/paletteToHue';
import { logStore } from '~/lib/stores/logs';
import { streamingState } from '~/lib/stores/streaming';
import { filesToArtifacts } from '~/utils/fileUtils';
import { supabaseConnection } from '~/lib/stores/supabase';
import { defaultDesignScheme, type DesignScheme } from '~/types/design-scheme';
import { hueToRepresentativeHex, type GenerationDirectives } from '~/lib/onboarding/answer-directives';
import type { ElementInfo } from '~/components/workbench/Inspector';
import { useMCPStore } from '~/lib/stores/mcp';
import type { LlmErrorAlertType } from '~/types/actions';
import {
  hasGenerationsRemaining,
  incrementGenerationsUsed,
  hasV2GenerationsRemaining,
  incrementV2GenerationsUsed,
} from '~/lib/freeTrial';
import { createGenerationChargeGate } from '~/lib/generationChargeGate';
import { authUserStore } from '~/lib/stores/auth';
import { buildFixPrompt } from '~/utils/buildFixPrompt';
import { setSidebarOpen } from '~/lib/stores/sidebar';
import type { ProgressAnnotation } from '~/types/context';

const logger = createScopedLogger('Chat');

/*
 * Unlocked 2026-08-21: the forced `temperature: 0` injection that used to make Opus 5 reject
 * non-reasoning calls was tied to the old ai SDK (v4.3.16). Confirmed resolved after the v7
 * SDK migration (ai@7.0.70) via direct source inspection (no default-temperature injection in
 * prepareLanguageModelCallOptions) and live generateText/streamText calls against claude-opus-5
 * through both api.llmcall.ts and api.chat.ts — both completed with finishReason "stop" and no
 * temperature-related error.
 */
const OPUS_PROMOTION_LOCKED = false;

// Error patterns that are almost always a one-line missing-import/typo fix — not worth Opus's cost.
const SIMPLE_MISTAKE_PATTERN = /is not defined|is not a function|Cannot find module|has no exported member/i;

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory, importChat, exportChat } = useChatHistory();
  const title = useStore(description);
  useEffect(() => {
    workbenchStore.setReloadedMessages(initialMessages.map((m) => m.id));
  }, [initialMessages]);

  return (
    <>
      {ready && (
        <ChatImpl
          description={title}
          initialMessages={initialMessages}
          exportChat={exportChat}
          storeMessageHistory={storeMessageHistory}
          importChat={importChat}
        />
      )}
    </>
  );
}

const processSampledMessages = createSampler(
  (options: {
    messages: UIMessage[];
    initialMessages: UIMessage[];
    isLoading: boolean;
    parseMessages: (messages: UIMessage[], isLoading: boolean) => void;
    storeMessageHistory: (messages: UIMessage[]) => Promise<void>;
  }) => {
    const { messages, initialMessages, isLoading, parseMessages, storeMessageHistory } = options;
    parseMessages(messages, isLoading);

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  },
  50,
);

interface ChatProps {
  initialMessages: UIMessage[];
  storeMessageHistory: (messages: UIMessage[]) => Promise<void>;
  importChat: (description: string, messages: UIMessage[]) => Promise<void>;
  exportChat: () => void;
  description?: string;
}

export const ChatImpl = memo(
  ({ description, initialMessages, storeMessageHistory, importChat, exportChat }: ChatProps) => {
    useShortcuts();

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [imageDataList, setImageDataList] = useState<string[]>([]);
    const [searchParams, setSearchParams] = useSearchParams();
    const [fakeLoading, setFakeLoading] = useState(false);
    const [clarifyingPrompt, setClarifyingPrompt] = useState<string | null>(null);
    const files = useStore(workbenchStore.files);

    /*
     * Stays undefined until the user actually saves a scheme via ColorSchemeDialog — this is
     * how the backend tells "no custom scheme chosen" apart from "user picked this on purpose."
     * ColorSchemeDialog falls back to defaultDesignScheme for its own editing UI regardless.
     */
    const [designScheme, setDesignScheme] = useState<DesignScheme | undefined>(undefined);
    const actionAlert = useStore(workbenchStore.alert);
    const deployAlert = useStore(workbenchStore.deployAlert);
    const supabaseConn = useStore(supabaseConnection);
    const supabaseAlert = useStore(workbenchStore.supabaseAlert);
    const { activeProviders, promptId, autoSelectTemplate, contextOptimizationEnabled } = useSettings();
    const [llmErrorAlert, setLlmErrorAlert] = useState<LlmErrorAlertType | undefined>(undefined);
    const [model, setModel] = useState(() => {
      if (!SHOW_DEV_TOOLS) {
        return DEFAULT_MODEL;
      }

      const savedModel = Cookies.get('selectedModel');

      return savedModel || DEFAULT_MODEL;
    });
    const [provider, setProvider] = useState(() => {
      if (!SHOW_DEV_TOOLS) {
        return DEFAULT_PROVIDER as ProviderInfo;
      }

      const savedProvider = Cookies.get('selectedProvider');

      return (PROVIDER_LIST.find((p) => p.name === savedProvider) || DEFAULT_PROVIDER) as ProviderInfo;
    });
    const { showChat } = useStore(chatStore);
    const [animationScope, animate] = useAnimate();
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [chatMode, setChatMode] = useState<'discuss' | 'build'>('build');
    const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
    const mcpSettings = useMCPStore((state) => state.settings);

    // v5 useChat() no longer returns `input`/`handleInputChange` — managed locally now.
    const [input, setInput] = useState(() => Cookies.get(PROMPT_COOKIE_KEY) || '');

    // v5 useChat() no longer returns `data`/`setData` for custom stream data — rebuilt via onData below.
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);

    /*
     * Caps automatic retries for transport-level failures (e.g. QUIC connection drops on long
     * streaming requests) at 1, so a request that keeps failing doesn't loop forever. Reset on
     * successful completion.
     */
    const networkRetryCountRef = useRef(0);
    const MAX_NETWORK_AUTO_RETRIES = 1;

    /*
     * METERING_FIX_REPORT.md: sites that used to call recordGenerationUsed() immediately (before
     * the request was even sent) now just arm() this gate instead — see generationChargeGate.ts.
     * onFinish() below (called from the useChat onFinish callback) is the single place that
     * actually charges, and only for a genuine success (not aborted, not errored), so a generation
     * that never completes successfully never costs the user a free/paid credit. recordGenerationUsed
     * is declared further down (const, so referencing it here in a closure is fine — this factory
     * call itself runs at render time, but the closure isn't invoked until a real finish happens,
     * long after recordGenerationUsed exists).
     */
    const generationChargeGateRef = useRef(createGenerationChargeGate(() => recordGenerationUsed()));

    const {
      messages,
      status,
      setMessages,
      error,
      sendMessage: sendChatMessage,
      regenerate,
      addToolOutput,
      stop,
    } = useChat({
      transport: new DefaultChatTransport({
        api: '/api/chat',

        /*
         * GEN_STALL_FIX2.md — diagnostic only, no behavior change: HttpChatTransport.sendMessages
         * accepts a custom `fetch` and falls back to it instead of the global one, so this wrapper
         * sees every actual dispatch/response/abort for /api/chat without touching library code.
         * Added because the previous round's regenerate().catch() never fires when the request is
         * aborted (Chat.regenerate()'s own catch treats AbortError as a normal outcome and returns
         * null instead of rejecting) — this is the only way to see an abort from here.
         */
        fetch: (input, init) => {
          logger.info('api/chat fetch: dispatching');

          /*
           * GEN_STALL_FIX2.md follow-up — confirmed via this same wrapper that the request is
           * aborted (AbortError, "signal is aborted without reason") before any response arrives.
           * Every .abort() call site found by reading Chat.stop()/handleError/the component tree
           * turned out to be unreachable from this exact flow (stop() is only invoked from a manual
           * button and from handleError, and handleError's onError trigger is never called for an
           * AbortError — Chat.regenerate()'s own catch returns before reaching it). This listener
           * doesn't change behavior — it just captures a stack trace at the moment abort() actually
           * fires, which is the only way left to find the real caller without browser access.
           */
          init?.signal?.addEventListener('abort', () => {
            logger.error('api/chat fetch: abort signal fired — call stack:', new Error().stack);
          });

          return fetch(input, init)
            .then((response) => {
              logger.info('api/chat fetch: response received', response.status, response.ok);
              return response;
            })
            .catch((fetchError: unknown) => {
              const err = fetchError as { name?: string; message?: string };
              logger.error('api/chat fetch: failed before a response arrived', err?.name, err?.message);
              throw fetchError;
            });
        },
        body: () => ({
          apiKeys,
          files,
          promptId,
          contextOptimization: contextOptimizationEnabled,
          chatMode,
          designScheme,
          supabase: {
            isConnected: supabaseConn.isConnected,

            /*
             * What actually matters for whether the AI should write real Supabase calls vs
             * sample-data code is "do we have usable credentials", not the PAT-flow's project-list
             * selection (selectedProjectId) — the simplified URL+anon-key wizard never populates
             * that at all, only credentials.
             */
            hasSelectedProject: !!(supabaseConn.credentials?.supabaseUrl && supabaseConn.credentials?.anonKey),
            credentials: {
              supabaseUrl: supabaseConn?.credentials?.supabaseUrl,
              anonKey: supabaseConn?.credentials?.anonKey,
            },
          },
          maxLLMSteps: mcpSettings.maxLLMSteps,
        }),
      }),
      onError: (e) => {
        setFakeLoading(false);
        handleError(e, 'chat');
      },
      onData: (dataPart) => {
        if (dataPart.type === 'data-progress') {
          setProgressAnnotations((prev) => [...prev, dataPart.data as ProgressAnnotation]);
        }
      },
      onFinish: ({ message, isAbort, isError }) => {
        setProgressAnnotations([]);
        networkRetryCountRef.current = 0;

        /*
         * Token usage logging was read from the v4 onFinish `response.usage` argument, which
         * no longer exists in v5's onFinish payload. Low-priority — revisit separately.
         */
        void message;

        logger.debug('Finished streaming');

        /*
         * METERING_FIX_REPORT.md: charge only on a genuine successful finish. onFinish fires for
         * every outcome (success, abort, error) — isAbort/isError (from the `ai` package's own
         * ChatOnFinishCallback) are how AbstractChat itself distinguishes them, so this doesn't
         * guess based on status/error state that could be stale or reset by something else.
         */
        generationChargeGateRef.current.onFinish({ isAbort, isError });
      },
      messages: initialMessages,
    });

    const isLoading = status === 'submitted' || status === 'streaming';

    /*
     * Preview errors while a generation is still streaming (e.g. main.tsx importing a file that
     * hasn't been written yet) are the expected/self-resolving case the auto-fix effect below now
     * waits out — surfacing the "should Coralred fix it?" banner for that window is just noise,
     * since it auto-clears as soon as isLoading flips false. Terminal-source alerts keep showing
     * immediately; they were never part of the silent auto-fix path.
     */
    const visibleActionAlert =
      actionAlert && (actionAlert.source !== 'preview' || !isLoading) ? actionAlert : undefined;

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
    };

    /*
     * Entry point for /templates' "이 템플릿으로 시작" cards (and any other future ?prompt= link) —
     * previously called sendChatMessage directly, which skipped the onboarding clarification step
     * entirely (bypassed the same !chatStarted gate that ExamplePrompts/the input bar go through
     * via sendMessage below). Fixed to route through the identical checkGenerationsAllowed +
     * setClarifyingPrompt path so a template click behaves exactly like typing the same prompt in.
     */
    useEffect(() => {
      const prompt = searchParams.get('prompt');

      if (prompt?.trim()) {
        setSearchParams({});

        (async () => {
          if (!(await checkGenerationsAllowed())) {
            return;
          }

          setClarifyingPrompt(prompt);
        })();
      }
    }, [searchParams]);

    const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
    const { parsedMessages, parseMessages } = useMessageParser();

    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    useEffect(() => {
      chatStore.setKey('started', initialMessages.length > 0);
    }, []);

    useEffect(() => {
      processSampledMessages({
        messages,
        initialMessages,
        isLoading,
        parseMessages,
        storeMessageHistory,
      });
    }, [messages, isLoading, parseMessages]);

    const scrollTextArea = () => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    };

    const abort = () => {
      stop();
      chatStore.setKey('aborted', true);
      workbenchStore.abortAllActions();

      logStore.logProvider('Chat response aborted', {
        component: 'Chat',
        action: 'abort',
        model,
        provider: provider.name,
      });
    };

    const handleError = useCallback(
      (error: any, context: 'chat' | 'template' | 'llmcall' = 'chat') => {
        logger.error(`${context} request failed`, error);

        stop();
        setFakeLoading(false);

        /*
         * statusCode defaults to 0 (not 500) — a plain-text error we can't parse as JSON (e.g.
         * stream-recovery's own give-up message, or AI_InvalidPromptError) must NOT be silently
         * treated as a 500 server error below, or it gets misclassified as 'network' and
         * auto-regenerate() fires on an error that has nothing to do with the network.
         */
        let errorInfo = {
          message: '알 수 없는 오류가 발생했어요.',
          isRetryable: true,
          statusCode: 0,
          provider: provider.name,
          type: 'unknown' as const,
          retryDelay: 0,
        };

        if (error.message) {
          try {
            const parsed = JSON.parse(error.message);

            if (parsed.error || parsed.message) {
              errorInfo = { ...errorInfo, ...parsed };
            } else {
              errorInfo.message = error.message;
            }
          } catch {
            errorInfo.message = error.message;
          }
        }

        let errorType: LlmErrorAlertType['errorType'] = 'unknown';
        let title = '요청 실패';

        if (errorInfo.statusCode === 401 || errorInfo.message.toLowerCase().includes('api key')) {
          errorType = 'authentication';
          title = '인증 오류';
        } else if (errorInfo.statusCode === 429 || errorInfo.message.toLowerCase().includes('rate limit')) {
          errorType = 'rate_limit';
          title = '요청 한도 초과';
        } else if (errorInfo.message.toLowerCase().includes('quota')) {
          errorType = 'quota';
          title = '사용량 초과';
        } else if (errorInfo.statusCode >= 500) {
          errorType = 'network';
          title = '서버 오류';
        }

        if (context === 'chat' && errorType === 'network' && networkRetryCountRef.current < MAX_NETWORK_AUTO_RETRIES) {
          networkRetryCountRef.current += 1;
          toast.warning('네트워크 연결이 끊겨서 다시 시도할게요...');
          regenerate();

          return;
        }

        logStore.logError(`${context} request failed`, error, {
          component: 'Chat',
          action: 'request',
          error: errorInfo.message,
          context,
          retryable: errorInfo.isRetryable,
          errorType,
          provider: provider.name,
        });

        // Create API error alert
        setLlmErrorAlert({
          type: 'error',
          title,
          description: errorInfo.message,
          provider: provider.name,
          errorType,
        });
        setProgressAnnotations([]);
      },
      [provider.name, stop, regenerate],
    );

    const clearApiErrorAlert = useCallback(() => {
      setLlmErrorAlert(undefined);
    }, []);

    useEffect(() => {
      const textarea = textareaRef.current;

      if (textarea) {
        textarea.style.height = 'auto';

        const scrollHeight = textarea.scrollHeight;

        textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
        textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
      }
    }, [input, textareaRef]);

    const runAnimation = async () => {
      if (chatStarted) {
        return;
      }

      try {
        await Promise.all([
          animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
          animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
        ]);
      } catch {
        // #intro/#examples may already be unmounted (e.g. after the clarification flow replaced them) — skip the fade animation.
      }

      chatStore.setKey('started', true);
      chatStore.setKey('autoFixAttempts', 0);

      setChatStarted(true);
    };

    // Helper: pre-loaded image data URLs (from paste/drag) -> v5 FileUIPart.
    const imagesToFileParts = (images: string[]): FileUIPart[] =>
      images.map((imageData) => ({
        type: 'file',
        mediaType: imageData.split(';')[0].split(':')[1] || 'image/jpeg',
        url: imageData,
      }));

    // Helper: uploaded File[] -> v5 FileUIPart[] (reads each file as a data URL).
    const filesToFileParts = async (files: File[]): Promise<FileUIPart[]> => {
      if (files.length === 0) {
        return [];
      }

      return Promise.all(
        files.map(
          (file) =>
            new Promise<FileUIPart>((resolve) => {
              const reader = new FileReader();

              reader.onloadend = () => {
                resolve({
                  type: 'file',
                  mediaType: file.type,
                  filename: file.name,
                  url: reader.result as string,
                });
              };
              reader.readAsDataURL(file);
            }),
        ),
      );
    };

    // Shows a limit-reached message; nudges guests toward the sidebar login buttons.
    const notifyGenerationLimitReached = () => {
      if (authUserStore.get()) {
        toast.error('무료 생성 횟수를 모두 사용했어요. 유료 플랜에서 계속 만들 수 있어요.');
        return;
      }

      toast.error('무료 체험을 다 쓰셨어요. 로그인하면 더 만들 수 있어요.');
      setSidebarOpen(true);
    };

    /*
     * Gates generation on the remaining-count check. If the check itself fails (network/RPC error),
     * fails closed — blocks generation rather than letting a broken check pass everyone through.
     */
    const checkGenerationsAllowed = async (): Promise<boolean> => {
      let remaining: boolean;

      try {
        remaining = CORALRED_NEW_METERING ? await hasV2GenerationsRemaining() : await hasGenerationsRemaining();
      } catch (error) {
        logger.error('Failed to check free generation limit', error);
        toast.error('일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.');

        return false;
      }

      if (!remaining) {
        notifyGenerationLimitReached();
        return false;
      }

      return true;
    };

    /*
     * overnight3 A5: single spot both call sites below use to record a real generation, so the
     * v2/legacy split lives in exactly one place. See CORALRED_NEW_METERING's own doc comment.
     */
    const recordGenerationUsed = async () => {
      try {
        await (CORALRED_NEW_METERING ? incrementV2GenerationsUsed() : incrementGenerationsUsed());
      } catch (error) {
        logger.error('Failed to record generation usage', error);
      }
    };

    /*
     * Runs the actual generation for a brand-new app (post-clarification, or skipped straight
     * through). designSchemeOverride, when given, is used INSTEAD OF the designScheme state for
     * this call's hue computation — needed because handleClarificationComplete calls
     * setDesignScheme(...) and generateNewApp(...) back to back, and React state updates are
     * async, so the designScheme closure here would otherwise still see the pre-update value.
     */
    const generateNewApp = async (promptContent: string, designSchemeOverride?: DesignScheme) => {
      runAnimation();

      const effectiveDesignScheme = designSchemeOverride ?? designScheme;

      if (!(await checkGenerationsAllowed())) {
        return;
      }

      /*
       * METERING_FIX_REPORT.md: recordGenerationUsed() used to run right here — before the
       * request even fired, so a stall/cancel/error still cost a free credit. The charge is now
       * armed immediately before each regenerate() call below instead (never here directly) so
       * an unrelated throw between this point and the actual request (e.g. selectStarterTemplate
       * rejecting) can't leave a stale armed charge for some later, unrelated onFinish to consume.
       */
      setFakeLoading(true);

      if (autoSelectTemplate) {
        const { template, title } = await selectStarterTemplate({
          message: promptContent,
          model,
          provider,
        });

        if (template !== 'blank') {
          const temResp = await getTemplates(template, title, designSchemeToHue(effectiveDesignScheme?.palette)).catch(
            (e) => {
              logger.warn(`Starter template import failed for "${template}", continuing with blank template:`, e);
              toast.warning('템플릿을 불러오지 못해 기본 설정으로 생성합니다');

              return null;
            },
          );

          if (temResp) {
            const { assistantMessage, userMessage } = temResp;
            const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${promptContent}`;
            const uploadedFileParts = await filesToFileParts(uploadedFiles);

            /*
             * NOTE: v4 relied on setMessages([...]) + reload() to seed a fake assistant turn and
             * resume generation from it. v5's regenerate() is designed to redo the last assistant
             * message, not resume from a synthetic history — this is carried over as the closest
             * equivalent but its runtime behavior with v5 has not been verified end-to-end.
             */
            setMessages([
              {
                id: `1-${new Date().getTime()}`,
                role: 'user',
                parts: [
                  { type: 'text', text: userMessageText },
                  ...imagesToFileParts(imageDataList),
                  ...uploadedFileParts,
                ],
              },
              {
                id: `2-${new Date().getTime()}`,
                role: 'assistant',
                parts: [{ type: 'text', text: assistantMessage }],
              },
              {
                id: `3-${new Date().getTime()}`,
                role: 'user',
                parts: [{ type: 'text', text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userMessage}` }],
                metadata: { hidden: true },
              },
            ]);

            /*
             * GEN_STALL_FIX.md — regenerate() was fired without await/catch: if its returned
             * promise rejects (or throws synchronously before making a request), nothing in this
             * file ever saw it — an unhandled rejection that looks, from the user's side, like
             * generation just silently stopped after "기본 파일을 만들었어요". This log is the
             * checkpoint that proves generateNewApp actually reached the trigger call; the .catch
             * below makes sure a rejection surfaces (console + the existing error-alert UI) instead
             * of vanishing.
             */
            logger.info('generateNewApp: template seeded, triggering regenerate()');
            generationChargeGateRef.current.arm();
            regenerate()
              .then(() => logger.info('generateNewApp: regenerate() settled (template import)'))
              .catch((e) => {
                // Rejected before onFinish could ever fire (e.g. thrown synchronously) — nothing to charge.
                generationChargeGateRef.current.disarm();
                logger.error('generateNewApp: regenerate() rejected after template import', e);
                handleError(e, 'chat');
              });
            setInput('');
            Cookies.remove(PROMPT_COOKIE_KEY);

            setUploadedFiles([]);
            setImageDataList([]);

            resetEnhancer();

            textareaRef.current?.blur();
            setFakeLoading(false);

            return;
          }
        }
      }

      /*
       * Reached when autoSelectTemplate is off, the LLM chose 'blank', or a GitHub template
       * fetch failed — every one of these previously sent a bare prompt with zero files,
       * meaning the design kit was never present. Seed the Coralred baseline (no GitHub
       * dependency, can't fail the way a template fetch can) via the same synthetic-history
       * mechanism used for real templates above.
       */
      const { assistantMessage, userMessage } = getBaselineTemplate(designSchemeToHue(effectiveDesignScheme?.palette));
      const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${promptContent}`;
      const uploadedFileParts = await filesToFileParts(uploadedFiles);

      setMessages([
        {
          id: `1-${new Date().getTime()}`,
          role: 'user',
          parts: [{ type: 'text', text: userMessageText }, ...imagesToFileParts(imageDataList), ...uploadedFileParts],
        },
        {
          id: `2-${new Date().getTime()}`,
          role: 'assistant',
          parts: [{ type: 'text', text: assistantMessage }],
        },
        {
          id: `3-${new Date().getTime()}`,
          role: 'user',
          parts: [{ type: 'text', text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${userMessage}` }],
          metadata: { hidden: true },
        },
      ]);

      // GEN_STALL_FIX.md — same reasoning as the template-import branch above.
      logger.info('generateNewApp: baseline seeded, triggering regenerate()');
      generationChargeGateRef.current.arm();
      regenerate()
        .then(() => logger.info('generateNewApp: regenerate() settled (baseline)'))
        .catch((e) => {
          // Rejected before onFinish could ever fire (e.g. thrown synchronously) — nothing to charge.
          generationChargeGateRef.current.disarm();
          logger.error('generateNewApp: regenerate() rejected after baseline seed', e);
          handleError(e, 'chat');
        });
      setFakeLoading(false);
      setInput('');
      Cookies.remove(PROMPT_COOKIE_KEY);

      setUploadedFiles([]);
      setImageDataList([]);

      resetEnhancer();

      textareaRef.current?.blur();
    };

    // Called by PromptClarification once the user finishes answering (or skips) — resumes generation.
    const handleClarificationComplete = (finalPrompt: string, directives: GenerationDirectives) => {
      setClarifyingPrompt(null);

      /*
       * Bug 1 fix: chatStarted previously only flipped true later, inside runAnimation() (called
       * from generateNewApp() below) — an async function that awaits a framer-motion animate()
       * call before setting it. That left a real window where clarifyingPrompt was already null
       * (PromptClarification unmounted) but chatStarted was still false, which renders BaseChat's
       * landing layout (centered card, isLanding=true ChatBox styling, id="intro" hero) instead
       * of the chat layout — the actual send/input bar chatBoxSection is shared between both
       * layouts, but the landing one is visually and structurally different enough that it read
       * as "the input disappeared" once generation (driven independently by the message/workbench
       * state) kept going. Setting both in the same handler, in the same tick, means React batches
       * them into one update — no intermediate render can observe "cleared survey, still landing".
       * runAnimation() still runs its own (now redundant but harmless) chatStarted=true — it
       * early-returns via its own `if (chatStarted) return` once this has taken effect.
       */
      chatStore.setKey('started', true);
      setChatStarted(true);

      const hueHex = directives.hue !== undefined ? hueToRepresentativeHex(directives.hue) : undefined;
      const designSchemeOverride: DesignScheme | undefined = hueHex
        ? { ...defaultDesignScheme, palette: { ...defaultDesignScheme.palette, primary: hueHex } }
        : undefined;

      /*
       * Also persisted to state (not just passed as an override) so ColorSchemeDialog and any
       * later generation in this session reflect the mood answer too, not just this first call.
       */
      if (designSchemeOverride) {
        setDesignScheme(designSchemeOverride);
      }

      generateNewApp(finalPrompt, designSchemeOverride);
    };

    /**
     * `modelOverride`, when given, replaces the `model`/`provider` React state ONLY for the
     * `[Model: ...][Provider: ...]` tag on this one outgoing message — the state itself, and
     * therefore every other message (past or future), is untouched.
     */
    const sendMessage = async (
      _event: React.UIEvent,
      messageInput?: string,
      modelOverride?: { model: string; providerName: string },
      isAutoFix: boolean = false,
    ) => {
      const messageContent = messageInput || input;

      if (!messageContent?.trim()) {
        return;
      }

      if (isLoading) {
        abort();
        return;
      }

      let finalMessageContent = messageContent;

      if (selectedElement) {
        logger.debug('Selected Element:', selectedElement);

        const elementInfo = `<div class=\"__boltSelectedElement__\" data-element='${JSON.stringify(selectedElement)}'>${JSON.stringify(`${selectedElement.displayText}`)}</div>`;
        finalMessageContent = messageContent + elementInfo;
      }

      if (!chatStarted) {
        if (!(await checkGenerationsAllowed())) {
          return;
        }

        setClarifyingPrompt(finalMessageContent);

        return;
      }

      /*
       * overnight3 A5: under the OLD (flag-off) metering, follow-up messages after the first one
       * were never counted at all — a real, currently-shipped gap (see OVERNIGHT-REPORT-3.md's A5
       * section). Deliberately left as-is here so flag-off behavior is unchanged; this block only
       * runs under the new metering, and never for auto-fix retries (those aren't a user utterance).
       */
      /*
       * METERING_FIX_REPORT.md: recordGenerationUsed() used to run right here — before
       * sendChatMessage() below was even called. Now just remembers "this message should charge
       * on success"; the charge itself is armed immediately before sendChatMessage() further down
       * (not here) and onFinish above does the actual increment, only on a real success.
       */
      const shouldChargeThisMessage = CORALRED_NEW_METERING && !isAutoFix;

      if (shouldChargeThisMessage && !(await checkGenerationsAllowed())) {
        return;
      }

      /*
       * Only drop the trailing message if it's the failed/incomplete assistant turn — not
       * unconditionally. Without the role check, every retry while `error` is still set (e.g.
       * repeated clicks after a failure that keeps failing) chops one more message off the end
       * each time, eventually emptying the whole array and making every subsequent send fail
       * instantly with "messages must not be empty".
       */
      if (error != null && messages[messages.length - 1]?.role === 'assistant') {
        setMessages(messages.slice(0, -1));
      }

      const modifiedFiles = workbenchStore.getModifiedFiles();

      chatStore.setKey('aborted', false);

      const taggedModel = modelOverride?.model ?? model;
      const taggedProviderName = modelOverride?.providerName ?? provider.name;

      const fileParts = [...imagesToFileParts(imageDataList), ...(await filesToFileParts(uploadedFiles))];

      if (modifiedFiles !== undefined) {
        const userUpdateArtifact = filesToArtifacts(modifiedFiles, `${Date.now()}`);
        const messageText = `[Model: ${taggedModel}]\n\n[Provider: ${taggedProviderName}]\n\n${userUpdateArtifact}${finalMessageContent}`;

        if (shouldChargeThisMessage) {
          generationChargeGateRef.current.arm();
        }

        sendChatMessage({
          text: messageText,
          files: fileParts.length > 0 ? fileParts : undefined,
        });

        workbenchStore.resetAllFileModifications();
      } else {
        const messageText = `[Model: ${taggedModel}]\n\n[Provider: ${taggedProviderName}]\n\n${finalMessageContent}`;

        if (shouldChargeThisMessage) {
          generationChargeGateRef.current.arm();
        }

        sendChatMessage({
          text: messageText,
          files: fileParts.length > 0 ? fileParts : undefined,
        });
      }

      setInput('');
      Cookies.remove(PROMPT_COOKIE_KEY);

      setUploadedFiles([]);
      setImageDataList([]);

      resetEnhancer();

      textareaRef.current?.blur();
    };

    /*
     * Auto-retries preview runtime errors by asking Coralred to fix them, up to a small cap.
     * Terminal errors are out of scope here — those keep the existing manual "물어보기" flow.
     *
     * GEN_STALL_FIX2.md root cause: the WebContainer preview can throw a runtime error (and fire
     * actionAlert) while the main generation request is still streaming — e.g. right after the
     * template-import regenerate() call, before all files are written. sendMessage()'s existing
     * `if (isLoading) { abort(); return; }` branch exists for the send button doubling as a stop
     * button, but this effect used to call sendMessage() unconditionally — so an actionAlert
     * arriving mid-stream silently aborted the in-flight generation instead of queuing the fix.
     * Waiting for isLoading to clear (and re-running when it does, via the dep array) fixes that
     * without touching sendMessage's loading/abort semantics that the manual stop button relies on.
     */
    useEffect(() => {
      if (!actionAlert || actionAlert.source !== 'preview' || isLoading) {
        return;
      }

      const attempts = chatStore.get().autoFixAttempts;

      if (attempts >= 2) {
        return;
      }

      const prompt = buildFixPrompt(true, actionAlert.content);

      /*
       * On the first preview error, promote to Opus for anything that isn't an obvious one-line mistake —
       * two strikes isn't needed, one failed preview is enough to call it a failed builder attempt.
       * modelOverride is passed straight into sendMessage's 3rd argument — it only affects the
       * [Model:/Provider:] tag baked into THIS message's text. It never calls setModel/setProvider or
       * touches the selectedModel/selectedProvider cookies, so the component's model/provider state is
       * untouched and the very next message (retry or user-typed) reads that unchanged state fresh.
       */
      let modelOverride: { model: string; providerName: string } | undefined;

      if (attempts === 0) {
        if (SIMPLE_MISTAKE_PATTERN.test(actionAlert.description)) {
          logger.debug('Auto-fix: 단순 실수로 판단, Sonnet 유지');
        } else if (OPUS_PROMOTION_LOCKED) {
          logger.debug('Auto-fix: 복잡한 에러로 판단됐지만 Opus 승격은 잠겨 있어 Sonnet 유지');
        } else {
          logger.debug('Auto-fix: 복잡한 에러로 판단, Opus로 1회 승격');
          modelOverride = { model: 'claude-opus-5', providerName: 'Anthropic' };
        }
      }

      chatStore.setKey('autoFixAttempts', attempts + 1);
      sendMessage({} as any, prompt, modelOverride, true);
      workbenchStore.clearAlert();
    }, [actionAlert, isLoading]);

    /**
     * Handles the change event for the textarea and updates the input state.
     * @param event - The change event from the textarea.
     */
    const onTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleInputChange(event);
    };

    /**
     * Debounced function to cache the prompt in cookies.
     * Caches the trimmed value of the textarea input after a delay to optimize performance.
     */
    const debouncedCachePrompt = useCallback(
      debounce((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const trimmedValue = event.target.value.trim();
        Cookies.set(PROMPT_COOKIE_KEY, trimmedValue, { expires: 30 });
      }, 1000),
      [],
    );

    useEffect(() => {
      const storedApiKeys = Cookies.get('apiKeys');

      if (storedApiKeys) {
        setApiKeys(JSON.parse(storedApiKeys));
      }
    }, []);

    const handleModelChange = (newModel: string) => {
      setModel(newModel);
      Cookies.set('selectedModel', newModel, { expires: 30 });
    };

    const handleProviderChange = (newProvider: ProviderInfo) => {
      setProvider(newProvider);
      Cookies.set('selectedProvider', newProvider.name, { expires: 30 });
    };

    const handleWebSearchResult = useCallback(
      (result: string) => {
        const currentInput = input || '';
        const newInput = currentInput.length > 0 ? `${result}\n\n${currentInput}` : result;

        // Update the input via the same mechanism as handleInputChange
        const syntheticEvent = {
          target: { value: newInput },
        } as React.ChangeEvent<HTMLTextAreaElement>;
        handleInputChange(syntheticEvent);
      },
      [input, handleInputChange],
    );

    return (
      <BaseChat
        ref={animationScope}
        textareaRef={textareaRef}
        input={input}
        showChat={showChat}
        chatStarted={chatStarted}
        clarifyingPrompt={clarifyingPrompt}
        onClarificationComplete={handleClarificationComplete}
        isStreaming={isLoading || fakeLoading}
        onStreamingChange={(streaming) => {
          streamingState.set(streaming);
        }}
        enhancingPrompt={enhancingPrompt}
        promptEnhanced={promptEnhanced}
        sendMessage={sendMessage}
        model={model}
        setModel={handleModelChange}
        provider={provider}
        setProvider={handleProviderChange}
        providerList={activeProviders}
        handleInputChange={(e) => {
          onTextareaChange(e);
          debouncedCachePrompt(e);
        }}
        handleStop={abort}
        description={description}
        importChat={importChat}
        exportChat={exportChat}
        messages={messages}
        parsedMessages={parsedMessages}
        enhancePrompt={() => {
          enhancePrompt(
            input,
            (input) => {
              setInput(input);
              scrollTextArea();
            },
            model,
            provider,
            apiKeys,
          );
        }}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        imageDataList={imageDataList}
        setImageDataList={setImageDataList}
        actionAlert={visibleActionAlert}
        clearAlert={() => workbenchStore.clearAlert()}
        supabaseAlert={supabaseAlert}
        clearSupabaseAlert={() => workbenchStore.clearSupabaseAlert()}
        deployAlert={deployAlert}
        clearDeployAlert={() => workbenchStore.clearDeployAlert()}
        llmErrorAlert={llmErrorAlert}
        clearLlmErrorAlert={clearApiErrorAlert}
        data={progressAnnotations}
        chatMode={chatMode}
        setChatMode={setChatMode}
        append={sendChatMessage}
        designScheme={designScheme}
        setDesignScheme={setDesignScheme}
        selectedElement={selectedElement}
        setSelectedElement={setSelectedElement}
        addToolOutput={addToolOutput}
        onWebSearchResult={handleWebSearchResult}
      />
    );
  },
);
