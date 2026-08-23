import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateAppQuestions } from './generateAppQuestions';

function mockFetchOnce(response: Partial<Response> & { json: () => Promise<any> }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      ...response,
    }),
  );
}

describe('generateAppQuestions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a plain JSON array response into ClarifyQuestionDefs', async () => {
    mockFetchOnce({
      json: async () => ({
        text: JSON.stringify([{ question: '어떤 자산을 매매하나요?', options: ['암호화폐', '주식', '외환(FX)'] }]),
      }),
    });

    const result = await generateAppQuestions('트레이딩 봇 만들어줘');

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result?.[0].question).toBe('어떤 자산을 매매하나요?');
    expect(result?.[0].isDynamic).toBe(true);
  });

  it('appends a "잘 모르겠어요" unsure option to every generated question', async () => {
    mockFetchOnce({
      json: async () => ({ text: JSON.stringify([{ question: 'Q?', options: ['A', 'B'] }]) }),
    });

    const result = await generateAppQuestions('아무거나');
    const lastOption = result?.[0].options.at(-1);

    expect(lastOption).toMatchObject({ label: '잘 모르겠어요', value: null, isUnsure: true });
  });

  it('strips a ```json fenced code block before parsing', async () => {
    mockFetchOnce({
      json: async () => ({
        text: '```json\n[{"question": "Q?", "options": ["A", "B"]}]\n```',
      }),
    });

    const result = await generateAppQuestions('아무거나');
    expect(result).toHaveLength(1);
  });

  it('strips a bare ``` fenced code block (no "json" tag) before parsing', async () => {
    mockFetchOnce({
      json: async () => ({ text: '```\n[{"question": "Q?", "options": ["A", "B"]}]\n```' }),
    });

    const result = await generateAppQuestions('아무거나');
    expect(result).toHaveLength(1);
  });

  it('returns an empty array unchanged when the model legitimately has no questions', async () => {
    mockFetchOnce({ json: async () => ({ text: '[]' }) });
    expect(await generateAppQuestions('아주 구체적인 요청')).toEqual([]);
  });

  it('falls back to null when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await generateAppQuestions('아무거나')).toBeNull();
  });

  it('falls back to null when the model returns malformed JSON', async () => {
    mockFetchOnce({ json: async () => ({ text: 'not valid json{{{' }) });
    expect(await generateAppQuestions('아무거나')).toBeNull();
  });

  it('falls back to null when a question has fewer than 2 options', async () => {
    mockFetchOnce({ json: async () => ({ text: JSON.stringify([{ question: 'Q?', options: ['only one'] }]) }) });
    expect(await generateAppQuestions('아무거나')).toBeNull();
  });

  it('falls back to null when a question has more than 4 options', async () => {
    mockFetchOnce({
      json: async () => ({ text: JSON.stringify([{ question: 'Q?', options: ['A', 'B', 'C', 'D', 'E'] }]) }),
    });
    expect(await generateAppQuestions('아무거나')).toBeNull();
  });

  it('falls back to null when there are more than the max allowed questions', async () => {
    const tooMany = Array.from({ length: 3 }, (_, i) => ({ question: `Q${i}?`, options: ['A', 'B'] }));
    mockFetchOnce({ json: async () => ({ text: JSON.stringify(tooMany) }) });
    expect(await generateAppQuestions('아무거나')).toBeNull();
  });

  it('falls back to null when fetch itself throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await generateAppQuestions('아무거나')).toBeNull();
  });

  it('falls back to null when the response is a JSON object instead of an array', async () => {
    mockFetchOnce({ json: async () => ({ text: JSON.stringify({ question: 'Q?', options: ['A', 'B'] }) }) });
    expect(await generateAppQuestions('아무거나')).toBeNull();
  });
});
