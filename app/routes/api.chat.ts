import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  isStepCount,
  type UIMessage,
  type TextUIPart,
} from 'ai';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS, type FileMap } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/common/prompts/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import type { IProviderSetting } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';
import { getFilePaths, selectContext } from '~/lib/.server/llm/select-context';
import type { ProgressAnnotation } from '~/types/context';
import { WORK_DIR } from '~/utils/constants';
import { createSummary } from '~/lib/.server/llm/create-summary';
import { extractPropertiesFromMessage } from '~/lib/.server/llm/utils';
import type { DesignScheme } from '~/types/design-scheme';
import { MCPService } from '~/lib/services/mcpService';
import { StreamRecoveryManager } from '~/lib/.server/llm/stream-recovery';
import { getPlatformUserId } from '~/lib/cloud/cloudPlatformAuth';
import { recordMessageUsage } from '~/lib/cloud/messageUsage';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

const logger = createScopedLogger('api.chat');

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');

    if (name && rest) {
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const { messages, files, promptId, contextOptimization, supabase, chatMode, designScheme, maxLLMSteps, chatId } =
    await request.json<{
      messages: Messages;
      files: any;
      promptId?: string;
      contextOptimization: boolean;
      chatMode: 'discuss' | 'build';
      designScheme?: DesignScheme;
      supabase?: {
        isConnected: boolean;
        hasSelectedProject: boolean;
        credentials?: {
          anonKey?: string;
          supabaseUrl?: string;
        };
      };
      maxLLMSteps: number;

      /** 토큰 로깅(message_usage)용 — 대화 식별. 없어도(구버전 클라이언트) 생성 자체는 그대로 진행된다. */
      chatId?: string;
    }>();

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = JSON.parse(parseCookies(cookieHeader || '').apiKeys || '{}');
  const providerSettings: Record<string, IProviderSetting> = JSON.parse(
    parseCookies(cookieHeader || '').providers || '{}',
  );

  const stream = new SwitchableStream();

  const cumulativeUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  let progressCounter: number = 1;

  /*
   * 토큰 로깅 — 인증은 이 라우트 전체에 원래 없었다(메터링은 클라이언트가 별도 RPC로 미리
   * 처리). Authorization 헤더가 있으면(Chat.client.tsx가 로그인 사용자만 붙인다) platform JWT를
   * 검증해 user_id를 얻고, 없으면 게스트로 null — getPlatformUserId 자체가 헤더/키 부재 시 그냥
   * null을 반환하므로 별도 분기 없이 안전하다.
   */
  const usageUserId = await getPlatformUserId(request).catch(() => null);
  const usageLastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  const usageMessageId = usageLastUserMessage?.id ?? 'unknown';
  const usageIsAutoFix = (usageLastUserMessage?.metadata as { isAutoFix?: boolean } | undefined)?.isAutoFix === true;

  try {
    const mcpService = MCPService.getInstance();
    const totalMessageContent = messages.reduce(
      (acc, message) =>
        acc +
        (message.parts
          ?.filter((part): part is TextUIPart => part.type === 'text')
          .map((part) => part.text)
          .join('') ?? ''),
      '',
    );
    logger.debug(`Total message length: ${totalMessageContent.split(' ').length}, words`);

    const uiMessageStream = createUIMessageStream<UIMessage>({
      async execute({ writer }) {
        const filePaths = getFilePaths(files || {});
        let filteredFiles: FileMap | undefined = undefined;
        let summary: string | undefined = undefined;
        let messageSliceId = 0;

        const processedMessages = await mcpService.processToolInvocations(messages, writer);

        if (processedMessages.length > 3) {
          messageSliceId = processedMessages.length - 3;
        }

        if (filePaths.length > 0 && contextOptimization) {
          logger.debug('Generating Chat Summary');
          writer.write({
            type: 'data-progress',
            data: {
              type: 'progress',
              label: 'summary',
              status: 'in-progress',
              order: progressCounter++,
              message: 'Analysing Request',
            } satisfies ProgressAnnotation,
            transient: true,
          });

          // Create a summary of the chat
          logger.debug(`Messages count: ${processedMessages.length}`);

          summary = await createSummary({
            messages: [...processedMessages],
            env: context.cloudflare?.env,
            apiKeys,
            providerSettings,
            promptId,
            contextOptimization,
            onEnd(resp) {
              if (resp.usage) {
                logger.debug('createSummary token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += resp.usage.outputTokens || 0;
                cumulativeUsage.promptTokens += resp.usage.inputTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
                cumulativeUsage.cacheReadTokens += resp.usage.inputTokenDetails?.cacheReadTokens || 0;
                cumulativeUsage.cacheWriteTokens += resp.usage.inputTokenDetails?.cacheWriteTokens || 0;
              }
            },
          });
          writer.write({
            type: 'data-progress',
            data: {
              type: 'progress',
              label: 'summary',
              status: 'complete',
              order: progressCounter++,
              message: 'Analysis Complete',
            } satisfies ProgressAnnotation,
            transient: true,
          });

          writer.write({
            type: 'data-chatSummary',
            id: 'chatSummary',
            data: {
              summary,
              chatId: processedMessages.slice(-1)?.[0]?.id,
            },
          });

          // Update context buffer
          logger.debug('Updating Context Buffer');
          writer.write({
            type: 'data-progress',
            data: {
              type: 'progress',
              label: 'context',
              status: 'in-progress',
              order: progressCounter++,
              message: 'Determining Files to Read',
            } satisfies ProgressAnnotation,
            transient: true,
          });

          // Select context files
          logger.debug(`Messages count: ${processedMessages.length}`);
          filteredFiles = await selectContext({
            messages: [...processedMessages],
            env: context.cloudflare?.env,
            apiKeys,
            files,
            providerSettings,
            promptId,
            contextOptimization,
            summary,
            onEnd(resp) {
              if (resp.usage) {
                logger.debug('selectContext token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += resp.usage.outputTokens || 0;
                cumulativeUsage.promptTokens += resp.usage.inputTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
                cumulativeUsage.cacheReadTokens += resp.usage.inputTokenDetails?.cacheReadTokens || 0;
                cumulativeUsage.cacheWriteTokens += resp.usage.inputTokenDetails?.cacheWriteTokens || 0;
              }
            },
          });

          if (filteredFiles) {
            logger.debug(`files in context : ${JSON.stringify(Object.keys(filteredFiles))}`);
          }

          writer.write({
            type: 'data-codeContext',
            id: 'codeContext',
            data: {
              files: Object.keys(filteredFiles).map((key) => {
                let path = key;

                if (path.startsWith(WORK_DIR)) {
                  path = path.replace(WORK_DIR, '');
                }

                return path;
              }),
            },
          });

          writer.write({
            type: 'data-progress',
            data: {
              type: 'progress',
              label: 'context',
              status: 'complete',
              order: progressCounter++,
              message: 'Code Files Selected',
            } satisfies ProgressAnnotation,
            transient: true,
          });

          // logger.debug('Code Files Selected');
        }

        const options: StreamingOptions = {
          supabaseConnection: supabase,
          toolChoice: 'auto',
          tools: mcpService.toolsWithoutExecute,
          stopWhen: isStepCount(maxLLMSteps),
          onStepEnd: ({ toolCalls }) => {
            // add tool call annotations for frontend processing
            toolCalls.forEach((toolCall) => {
              mcpService.processToolCall(toolCall, writer);
            });
          },
          onEnd: async ({ text: content, finishReason, usage }) => {
            logger.debug('usage', JSON.stringify(usage));

            if (usage) {
              cumulativeUsage.completionTokens += usage.outputTokens || 0;
              cumulativeUsage.promptTokens += usage.inputTokens || 0;
              cumulativeUsage.totalTokens += usage.totalTokens || 0;
              cumulativeUsage.cacheReadTokens += usage.inputTokenDetails?.cacheReadTokens || 0;
              cumulativeUsage.cacheWriteTokens += usage.inputTokenDetails?.cacheWriteTokens || 0;
            }

            if (finishReason !== 'length') {
              writer.write({
                type: 'data-usage',
                id: 'usage',
                data: {
                  completionTokens: cumulativeUsage.completionTokens,
                  promptTokens: cumulativeUsage.promptTokens,
                  totalTokens: cumulativeUsage.totalTokens,
                },
              });
              writer.write({
                type: 'data-progress',
                data: {
                  type: 'progress',
                  label: 'response',
                  status: 'complete',
                  order: progressCounter++,
                  message: 'Response Generated',
                } satisfies ProgressAnnotation,
                transient: true,
              });

              // 메시지별 토큰 로깅 — 실패해도(키 미설정 포함) 생성 응답에 영향 주면 안 되므로 await하지 않는다.
              if (chatId) {
                const { model } = usageLastUserMessage
                  ? extractPropertiesFromMessage(usageLastUserMessage)
                  : { model: 'unknown' };

                void recordMessageUsage(
                  {
                    userId: usageUserId,
                    chatId,
                    messageId: usageMessageId,
                    promptTokens: cumulativeUsage.promptTokens,
                    completionTokens: cumulativeUsage.completionTokens,
                    cacheReadTokens: cumulativeUsage.cacheReadTokens,
                    cacheWriteTokens: cumulativeUsage.cacheWriteTokens,
                    model,
                    isAutoFix: usageIsAutoFix,
                  },
                  context.cloudflare?.env as any,
                );
              }

              await new Promise((resolve) => setTimeout(resolve, 0));

              // stream.close();
              return;
            }

            if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
              throw Error('Cannot continue message: Maximum segments reached');
            }

            const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

            logger.info(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

            const lastUserMessage = processedMessages.filter((x) => x.role == 'user').slice(-1)[0];
            const { model, provider } = extractPropertiesFromMessage(lastUserMessage);
            processedMessages.push({ id: generateId(), role: 'assistant', parts: [{ type: 'text', text: content }] });
            processedMessages.push({
              id: generateId(),
              role: 'user',
              parts: [{ type: 'text', text: `[Model: ${model}]\n\n[Provider: ${provider}]\n\n${CONTINUE_PROMPT}` }],
            });

            const result = await streamText({
              messages: [...processedMessages],
              env: context.cloudflare?.env,
              options,
              apiKeys,
              files,
              providerSettings,
              promptId,
              contextOptimization,
              contextFiles: filteredFiles,
              chatMode,
              designScheme,
              summary,
              messageSliceId,
            });

            writer.merge(result.toUIMessageStream());

            (async () => {
              for await (const part of result.stream) {
                if (part.type === 'error') {
                  const error: any = part.error;
                  logger.error(`${error}`);

                  return;
                }
              }
            })();

            return;
          },
        };

        writer.write({
          type: 'data-progress',
          data: {
            type: 'progress',
            label: 'response',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Generating Response',
          } satisfies ProgressAnnotation,
          transient: true,
        });

        const buildStreamTextParams = (signal: AbortSignal) => ({
          messages: [...processedMessages],
          env: context.cloudflare?.env,
          options: { ...options, abortSignal: signal },
          apiKeys,
          files,
          providerSettings,
          promptId,
          contextOptimization,
          contextFiles: filteredFiles,
          chatMode,
          designScheme,
          summary,
          messageSliceId,
        });

        type StreamRun = { controller: AbortController; intentionallyAborted: boolean };

        const consumeRun = async (
          run: StreamRun,
          result: Awaited<ReturnType<typeof streamText>>,
          recovery: StreamRecoveryManager,
        ) => {
          try {
            for await (const part of result.stream) {
              recovery.updateActivity();

              if (part.type === 'abort') {
                /*
                 * Intentional abort (stall retry or client disconnect), not a real completion.
                 * Whoever triggered the abort owns cleanup/next steps — don't touch `recovery` here.
                 * (A stale run's normal-completion `stop()` used to race with the retry's own timer —
                 * each run now gets its own StreamRecoveryManager, so this is now also just belt-and-braces.)
                 */
                return;
              }

              if (part.type === 'error') {
                if (run.intentionallyAborted) {
                  return;
                }

                const error: any = part.error;
                logger.error('Streaming error:', error);
                recovery.stop();

                // Enhanced error handling for common streaming issues
                if (error.message?.includes('Invalid JSON response')) {
                  logger.error('Invalid JSON response detected - likely malformed API response');
                } else if (error.message?.includes('token')) {
                  logger.error('Token-related error detected - possible token limit exceeded');
                }

                return;
              }
            }
            recovery.stop();
          } catch (err) {
            if (!run.intentionallyAborted) {
              logger.error('Streaming loop failed:', err);
            }
          }
        };

        let currentRun: StreamRun = { controller: new AbortController(), intentionallyAborted: false };
        let result = await streamText(buildStreamTextParams(currentRun.controller.signal));

        const MAX_STALL_RETRIES = 1;
        let stallRetryCount = 0;

        /*
         * Each run (the original stream and every retry) gets its own StreamRecoveryManager
         * instead of sharing one. Sharing one instance meant the original run's own consumeRun
         * loop — still alive in the background after being intentionally aborted — would call
         * `.stop()` on normal loop completion once it saw the abort, permanently killing the
         * *retry's* timer (StreamRecoveryManager.stop() can't be restarted). That's why a stalled
         * retry never reached onGiveUp: the second 45s timer had already been cleared. Giving each
         * run its own instance (maxRetries: 0, so it always fires onGiveUp on its own single
         * timeout) removes the shared mutable state entirely; retry-vs-give-up is now decided
         * here via `stallRetryCount`, not inside the manager.
         */
        const createStreamRecovery = (): StreamRecoveryManager =>
          new StreamRecoveryManager({
            timeout: 45000,
            maxRetries: 0,
            onGiveUp: async () => {
              if (stallRetryCount >= MAX_STALL_RETRIES) {
                logger.error('Stream recovery exhausted — ending stream with a clear error instead of hanging');

                currentRun.intentionallyAborted = true;
                currentRun.controller.abort();

                writer.write({
                  type: 'error',
                  errorText: '응답 생성이 너무 오래 걸려 중단했어요. 다시 시도해주세요.',
                });

                return;
              }

              stallRetryCount++;
              logger.warn(`Stream produced no output for 45s — retrying (attempt ${stallRetryCount})`);

              writer.write({
                type: 'data-progress',
                data: {
                  type: 'progress',
                  label: 'response',
                  status: 'in-progress',
                  order: progressCounter++,
                  message: '응답이 지연되고 있어요. 다시 시도할게요...',
                } satisfies ProgressAnnotation,
                transient: true,
              });

              currentRun.intentionallyAborted = true;
              currentRun.controller.abort();

              try {
                currentRun = { controller: new AbortController(), intentionallyAborted: false };
                result = await streamText(buildStreamTextParams(currentRun.controller.signal));

                const retryRecovery = createStreamRecovery();
                retryRecovery.startMonitoring();
                consumeRun(currentRun, result, retryRecovery);
                writer.merge(result.toUIMessageStream());
              } catch (retryError) {
                logger.error('Retry attempt failed to start:', retryError);
                writer.write({
                  type: 'error',
                  errorText: '응답 생성이 너무 오래 걸려 중단했어요. 다시 시도해주세요.',
                });
              }
            },
          });

        const streamRecovery = createStreamRecovery();
        streamRecovery.startMonitoring();
        consumeRun(currentRun, result, streamRecovery);
        writer.merge(result.toUIMessageStream());
      },
      onError: (error: any) => {
        // Provide more specific error messages for common issues
        const errorMessage = error.message || 'Unknown error';

        if (errorMessage.includes('model') && errorMessage.includes('not found')) {
          return '선택한 모델을 찾을 수 없어요. 모델 이름이 올바른지, 사용 가능한 모델인지 확인해주세요.';
        }

        if (errorMessage.includes('Invalid JSON response')) {
          /*
           * 자연스러운 한국어 문구를 위해 'api key' 부분 문자열을 없앴다. 이 메시지는
           * Chat.client.tsx의 errorType 판별(authentication/rate_limit/quota) 어디에도
           * 매치되지 않아 statusCode 기본값(500)에 따라 '서버 오류'로 분류된다 — 의도된 동작.
           */
          return 'AI 서비스가 올바르지 않은 응답을 보냈어요. 모델 이름이 잘못됐거나 요청이 많거나 서버에 문제가 있을 수 있어요. 다른 모델을 선택하거나 API 키 설정을 확인해주세요.';
        }

        if (
          errorMessage.includes('API key') ||
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('authentication')
        ) {
          /*
           * 자연스러운 한국어 문구를 위해 'api key' 부분 문자열을 없앴다. 그 결과 이 메시지는
           * Chat.client.tsx의 errorType 판별에서 더 이상 '인증 오류'로 매치되지 않고
           * statusCode 기본값(500)에 따라 '서버 오류'로 분류된다 — 의도된 동작.
           */
          return 'API 키가 없거나 올바르지 않아요. 설정을 확인해주세요.';
        }

        if (errorMessage.includes('token') && errorMessage.includes('limit')) {
          return '대화가 너무 길어서 토큰 한도를 초과했어요. 컨텍스트 창이 더 큰 모델을 사용하거나 새 대화를 시작해주세요.';
        }

        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          /*
           * 자연스러운 한국어 문구를 위해 'rate limit' 부분 문자열을 없앴다. 그 결과 이 메시지는
           * Chat.client.tsx의 errorType 판별에서 더 이상 '요청 한도 초과'로 매치되지 않고
           * statusCode 기본값(500)에 따라 '서버 오류'로 분류된다 — 의도된 동작.
           */
          return '너무 많이 요청해서 잠시 제한됐어요. 잠깐 기다렸다가 다시 시도해주세요.';
        }

        if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          return '네트워크에 문제가 있어요. 인터넷 연결을 확인하고 다시 시도해주세요.';
        }

        return `문제가 발생했어요: ${errorMessage}`;
      },
    });

    return createUIMessageStreamResponse({ stream: uiMessageStream });
  } catch (error: any) {
    logger.error(error);

    const errorResponse = {
      error: true,
      message: error.message || '예상치 못한 오류가 발생했어요.',
      statusCode: error.statusCode || 500,
      isRetryable: error.isRetryable !== false, // Default to retryable unless explicitly false
      provider: error.provider || 'unknown',
    };

    if (error.message?.includes('API key')) {
      return new Response(
        JSON.stringify({
          ...errorResponse,
          message: 'API 키가 없거나 올바르지 않아요.',
          statusCode: 401,
          isRetryable: false,
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          statusText: 'Unauthorized',
        },
      );
    }

    return new Response(JSON.stringify(errorResponse), {
      status: errorResponse.statusCode,
      headers: { 'Content-Type': 'application/json' },
      statusText: 'Error',
    });
  }
}
