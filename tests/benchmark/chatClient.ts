/**
 * /api/chat를 UI 없이 직접 호출하는 클라이언트. Chat.client.tsx의 DefaultChatTransport가 실제로
 * 보내는 body 모양을 그대로 재현한다(app/components/chat/Chat.client.tsx의 body 리졸버 참고).
 *
 * effort/thinking 파라미터는 요청 body에 없다 — app/lib/.server/llm/stream-text.ts가 모델 이름만
 * 보고 서버에서 결정한다(NO_THINKING_MODELS = ['claude-sonnet-5','claude-opus-5']에 대해서만
 * thinking:disabled를 강제하고, claude-fable-5-1은 아무것도 안 건드려 Anthropic API 자체 기본값
 * (effort=high, adaptive thinking)을 그대로 탄다) — 그래서 이 클라이언트가 따로 effort를 보낼
 * 방법이 없고, 보낼 필요도 없다(파이프라인을 있는 그대로 재는 게 목적이므로).
 */
import type { FileMap, ModelId } from './lib.ts';
import { taggedMessage } from './lib.ts';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: 'text'; text: string }>;
  metadata?: Record<string, unknown>;
}

export interface RawUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCallResult {
  text: string;
  usage: RawUsage;
  elapsedSec: number;
  httpStatus: number;
  errorText?: string;
}

export function userMessage(
  model: ModelId,
  providerName: string,
  text: string,
  metadata?: Record<string, unknown>,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    parts: [{ type: 'text', text: taggedMessage(model, providerName, text) }],
    ...(metadata ? { metadata } : {}),
  };
}

export function assistantMessage(text: string): ChatMessage {
  return { id: crypto.randomUUID(), role: 'assistant', parts: [{ type: 'text', text }] };
}

/** SSE 형태("data: {...}\n\n")로 오는 AI SDK v5 UI 메시지 스트림을 완결된 텍스트+usage로 합친다. */
function parseUiMessageStream(body: string): { text: string; usage: RawUsage | null; errorText?: string } {
  let text = '';
  let usage: RawUsage | null = null;
  let errorText: string | undefined;

  for (const line of body.split('\n')) {
    if (!line.startsWith('data: ')) {
      continue;
    }

    const payload = line.slice('data: '.length).trim();

    if (payload === '[DONE]' || payload === '') {
      continue;
    }

    let event: any;

    try {
      event = JSON.parse(payload);
    } catch {
      continue;
    }

    if (event.type === 'text-delta' && typeof event.delta === 'string') {
      text += event.delta;
    } else if (event.type === 'data-usage' && event.data) {
      usage = {
        promptTokens: event.data.promptTokens ?? 0,
        completionTokens: event.data.completionTokens ?? 0,
        totalTokens: event.data.totalTokens ?? 0,
      };
    } else if (event.type === 'error') {
      errorText = event.errorText ?? JSON.stringify(event);
    }
  }

  return { text, usage, errorText };
}

export async function callChat(opts: {
  baseUrl: string;
  messages: ChatMessage[];
  files: FileMap;
  chatId: string;
}): Promise<ChatCallResult> {
  const start = performance.now();

  const response = await fetch(`${opts.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: opts.messages,
      files: opts.files,

      /*
       * 기본값(app/lib/stores/settings.ts initialSettings.contextOptimization)이 true다 — 이게
       * 꺼져 있으면 files 파라미터는 잠금 파일 계산에만 쓰이고 시스템 프롬프트에 파일 "내용"이
       * 전혀 안 들어간다(app/lib/.server/llm/stream-text.ts 232번째 줄 부근 확인). 대화 이력이
       * 없는 D(막힌 자동수정) 케이스는 이게 꺼져 있으면 모델이 파일을 아예 못 본다 — 실측으로 확인.
       */
      contextOptimization: true,
      chatMode: 'build',
      maxLLMSteps: 5,
      chatId: opts.chatId,
    }),
  });

  const bodyText = await response.text();
  const elapsedSec = (performance.now() - start) / 1000;

  if (!response.ok) {
    return {
      text: '',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      elapsedSec,
      httpStatus: response.status,
      errorText: bodyText.slice(0, 2000),
    };
  }

  const parsed = parseUiMessageStream(bodyText);

  return {
    text: parsed.text,
    usage: parsed.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    elapsedSec,
    httpStatus: response.status,
    errorText: parsed.errorText,
  };
}
