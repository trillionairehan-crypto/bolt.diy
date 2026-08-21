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
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROMPT_COOKIE_KEY, PROVIDER_LIST, SHOW_DEV_TOOLS } from '~/utils/constants';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';
import Cookies from 'js-cookie';
import { debounce } from '~/utils/debounce';
import { useSettings } from '~/lib/hooks/useSettings';
import type { ProviderInfo } from '~/types/model';
import { useSearchParams } from '@remix-run/react';
import { createSampler } from '~/utils/sampler';
import { getTemplates, selectStarterTemplate } from '~/utils/selectStarterTemplate';
import { logStore } from '~/lib/stores/logs';
import { streamingState } from '~/lib/stores/streaming';
import { filesToArtifacts } from '~/utils/fileUtils';
import { supabaseConnection } from '~/lib/stores/supabase';
import { defaultDesignScheme, type DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import { useMCPStore } from '~/lib/stores/mcp';
import type { LlmErrorAlertType } from '~/types/actions';
import { hasGenerationsRemaining, incrementGenerationsUsed } from '~/lib/freeTrial';
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
    const [designScheme, setDesignScheme] = useState<DesignScheme>(defaultDesignScheme);
    const actionAlert = useStore(workbenchStore.alert);
    const deployAlert = useStore(workbenchStore.deployAlert);
    const supabaseConn = useStore(supabaseConnection);
    const selectedProject = supabaseConn.stats?.projects?.find(
      (project) => project.id === supabaseConn.selectedProjectId,
    );
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
        body: () => ({
          apiKeys,
          files,
          promptId,
          contextOptimization: contextOptimizationEnabled,
          chatMode,
          designScheme,
          supabase: {
            isConnected: supabaseConn.isConnected,
            hasSelectedProject: !!selectedProject,
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
      onFinish: ({ message }) => {
        setProgressAnnotations([]);

        // Token usage logging was read from the v4 onFinish `response.usage` argument, which
        // no longer exists in v5's onFinish payload. Low-priority — revisit separately.
        void message;

        logger.debug('Finished streaming');
      },
      messages: initialMessages,
    });

    const isLoading = status === 'submitted' || status === 'streaming';

    const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
    };

    useEffect(() => {
      const prompt = searchParams.get('prompt');

      // console.log(prompt, searchParams, model, provider);

      if (prompt) {
        setSearchParams({});
        runAnimation();
        sendChatMessage({
          text: `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${prompt}`,
        });
      }
    }, [model, provider, searchParams]);

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

        let errorInfo = {
          message: '알 수 없는 오류가 발생했어요.',
          isRetryable: true,
          statusCode: 500,
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
      [provider.name, stop],
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

    // Gates generation on the remaining-count check. If the check itself fails (network/RPC error),
    // fails closed — blocks generation rather than letting a broken check pass everyone through.
    const checkGenerationsAllowed = async (): Promise<boolean> => {
      let remaining: boolean;

      try {
        remaining = await hasGenerationsRemaining();
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

    // Runs the actual generation for a brand-new app (post-clarification, or skipped straight through).
    const generateNewApp = async (promptContent: string) => {
      runAnimation();

      if (!(await checkGenerationsAllowed())) {
        return;
      }

      try {
        await incrementGenerationsUsed();
      } catch (error) {
        logger.error('Failed to record generation usage', error);
      }

      setFakeLoading(true);

      if (autoSelectTemplate) {
        const { template, title } = await selectStarterTemplate({
          message: promptContent,
          model,
          provider,
        });

        if (template !== 'blank') {
          const temResp = await getTemplates(template, title).catch((e) => {
            if (e.message.includes('rate limit')) {
              toast.warning('Rate limit exceeded. Skipping starter template\n Continuing with blank template');
            } else {
              toast.warning('Failed to import starter template\n Continuing with blank template');
            }

            return null;
          });

          if (temResp) {
            const { assistantMessage, userMessage } = temResp;
            const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${promptContent}`;

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
                parts: [{ type: 'text', text: userMessageText }, ...imagesToFileParts(imageDataList)],
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

            regenerate();
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

      // If autoSelectTemplate is disabled or template selection failed, proceed with normal message
      const userMessageText = `[Model: ${model}]\n\n[Provider: ${provider.name}]\n\n${promptContent}`;
      const fileParts = [...imagesToFileParts(imageDataList), ...(await filesToFileParts(uploadedFiles))];

      sendChatMessage({
        text: userMessageText,
        files: fileParts.length > 0 ? fileParts : undefined,
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
    const handleClarificationComplete = (finalPrompt: string) => {
      setClarifyingPrompt(null);
      generateNewApp(finalPrompt);
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
        console.log('Selected Element:', selectedElement);

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

      if (error != null) {
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

        sendChatMessage({
          text: messageText,
          files: fileParts.length > 0 ? fileParts : undefined,
        });

        workbenchStore.resetAllFileModifications();
      } else {
        const messageText = `[Model: ${taggedModel}]\n\n[Provider: ${taggedProviderName}]\n\n${finalMessageContent}`;

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

    // Auto-retries preview runtime errors by asking Coralred to fix them, up to a small cap.
    // Terminal errors are out of scope here — those keep the existing manual "물어보기" flow.
    useEffect(() => {
      if (!actionAlert || actionAlert.source !== 'preview') {
        return;
      }

      const attempts = chatStore.get().autoFixAttempts;

      if (attempts >= 2) {
        return;
      }

      const prompt = buildFixPrompt(true, actionAlert.content);

      // On the last automatic retry, promote to Opus for anything that isn't an obvious one-line mistake.
      // modelOverride is passed straight into sendMessage's 3rd argument — it only affects the
      // [Model:/Provider:] tag baked into THIS message's text. It never calls setModel/setProvider or
      // touches the selectedModel/selectedProvider cookies, so the component's model/provider state is
      // untouched and the very next message (retry or user-typed) reads that unchanged state fresh.
      let modelOverride: { model: string; providerName: string } | undefined;

      if (attempts === 1) {
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
      sendMessage({} as any, prompt, modelOverride);
      workbenchStore.clearAlert();
    }, [actionAlert]);

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
        actionAlert={actionAlert}
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
