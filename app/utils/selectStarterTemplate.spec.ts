import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectStarterTemplate } from './selectStarterTemplate';

const options = {
  message: '트레이딩 봇 만들어줘',
  model: 'test-model',
  provider: { name: 'test-provider' } as any,
};

describe('selectStarterTemplate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed template on a normal successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          text: '<selection><templateName>react-basic-starter</templateName><title>Todo</title></selection>',
        }),
      }),
    );

    const result = await selectStarterTemplate(options);

    expect(result).toEqual({ template: 'react-basic-starter', title: 'Todo' });
  });

  it('falls back to the blank template instead of throwing when the fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await selectStarterTemplate(options);

    expect(result).toEqual({ template: 'blank', title: '' });
  });

  it('falls back to the blank template instead of throwing when the response body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      }),
    );

    const result = await selectStarterTemplate(options);

    expect(result).toEqual({ template: 'blank', title: '' });
  });
});
