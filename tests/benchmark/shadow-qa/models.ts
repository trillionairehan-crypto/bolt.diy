/*
 * shadow-qa 전용 모델 호출기 — /api/llmcall(파이프라인 라우트)을 거치지 않고 각 provider API를
 * 직접 호출한다. 이유: 프로덕션 시각 검토(reviewGeneratedApp.ts)는 이미지 1장만 지원하는데(image:
 * 단일 string, app/routes/api.llmcall.ts) 이 실험은 데스크톱+모바일 2장을 같은 호출에 넣어야
 * 한다 — 라우트를 건드리지 않고(파이프라인 코드 수정 금지) 2장을 보내려면 provider API를 직접
 * 쓰는 게 유일한 방법이다. 체크리스트 시스템 프롬프트 자체는 review-checklist.ts에서 그대로
 * import해서 쓴다(문구 불일치 없음).
 */

export interface RawVisualCallResult {
  rawText: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  httpStatus: number;
  errorText?: string;
}

const ANTHROPIC_VERSION = '2023-06-01';
const MAX_OUTPUT_TOKENS = 8000;

/** claude-sonnet-5, thinking 비활성 — 프로덕션 시각 검토와 동일 설정(reviewGeneratedApp.ts 참고). */
export async function callClaudeVisual(opts: {
  systemPrompt: string;
  userText: string;
  desktopBase64: string;
  mobileBase64: string;
  model?: string;
}): Promise<RawVisualCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = opts.model ?? 'claude-sonnet-5';

  if (!apiKey) {
    return {
      rawText: '',
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      httpStatus: 0,
      errorText: 'ANTHROPIC_API_KEY 없음 — .env에 추가 필요',
    };
  }

  const t0 = performance.now();

  let response: Response;

  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: opts.systemPrompt,
        thinking: { type: 'disabled' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: opts.userText },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: opts.desktopBase64 } },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: opts.mobileBase64 } },
            ],
          },
        ],
      }),
    });
  } catch (error) {
    return {
      rawText: '',
      latencyMs: Math.round(performance.now() - t0),
      inputTokens: 0,
      outputTokens: 0,
      httpStatus: 0,
      errorText: String((error as Error)?.message ?? error),
    };
  }

  const latencyMs = Math.round(performance.now() - t0);
  const body: any = await response.json().catch(() => null);

  if (!response.ok || !body) {
    return {
      rawText: '',
      latencyMs,
      inputTokens: 0,
      outputTokens: 0,
      httpStatus: response.status,
      errorText: JSON.stringify(body ?? {}).slice(0, 500),
    };
  }

  const rawText = (body.content ?? [])
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('');

  return {
    rawText,
    latencyMs,
    inputTokens: body.usage?.input_tokens ?? 0,
    outputTokens: body.usage?.output_tokens ?? 0,
    httpStatus: response.status,
  };
}

/*
 * OpenAI 최신 모델 — 정확한 모델 id는 계정/시점마다 달라서 env(SHADOW_QA_OPENAI_MODEL)로 지정한다.
 * 기본값은 확정된 값이 아니라 임시 추정치이니 실행 전에 실제 계정에서 쓸 수 있는 최신 모델 id로
 * 덮어써야 한다 — README_확인필요.md 참고.
 */
const DEFAULT_OPENAI_MODEL = process.env.SHADOW_QA_OPENAI_MODEL ?? 'gpt-5.1';

/** Responses API 사용 — store:false로 호출해서 응답을 OpenAI 쪽에 보관하지 않는다(요청사항 3번). */
export async function callOpenAiVisual(opts: {
  systemPrompt: string;
  userText: string;
  desktopDataUrl: string;
  mobileDataUrl: string;
  model?: string;
}): Promise<RawVisualCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = opts.model ?? DEFAULT_OPENAI_MODEL;

  if (!apiKey) {
    return {
      rawText: '',
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      httpStatus: 0,
      errorText: 'OPENAI_API_KEY 없음 — .env에 추가 필요',
    };
  }

  const t0 = performance.now();

  let response: Response;

  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: opts.systemPrompt }] },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: opts.userText },
              { type: 'input_image', image_url: opts.desktopDataUrl },
              { type: 'input_image', image_url: opts.mobileDataUrl },
            ],
          },
        ],
      }),
    });
  } catch (error) {
    return {
      rawText: '',
      latencyMs: Math.round(performance.now() - t0),
      inputTokens: 0,
      outputTokens: 0,
      httpStatus: 0,
      errorText: String((error as Error)?.message ?? error),
    };
  }

  const latencyMs = Math.round(performance.now() - t0);
  const body: any = await response.json().catch(() => null);

  if (!response.ok || !body) {
    return {
      rawText: '',
      latencyMs,
      inputTokens: 0,
      outputTokens: 0,
      httpStatus: response.status,
      errorText: JSON.stringify(body ?? {}).slice(0, 500),
    };
  }

  const rawText: string =
    body.output_text ??
    (body.output ?? [])
      .flatMap((item: any) => item.content ?? [])
      .filter((content: any) => content.type === 'output_text')
      .map((content: any) => content.text)
      .join('');

  return {
    rawText,
    latencyMs,
    inputTokens: body.usage?.input_tokens ?? 0,
    outputTokens: body.usage?.output_tokens ?? 0,
    httpStatus: response.status,
  };
}
