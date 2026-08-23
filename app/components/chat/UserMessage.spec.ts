import { describe, expect, it } from 'vitest';
import { splitDisplayText } from './UserMessage';
import { ONBOARDING_ADDITIONS_MARKER } from '~/utils/constants';

function textParts(text: string) {
  return [{ type: 'text' as const, text }];
}

describe('splitDisplayText', () => {
  it('returns the raw text unchanged when there is no marker', () => {
    const result = splitDisplayText(textParts('가계부 앱 만들어줘'));
    expect(result).toEqual({ text: '가계부 앱 만들어줘', additionsCount: 0 });
  });

  it('strips the [Model:]/[Provider:] routing tags', () => {
    const result = splitDisplayText(
      textParts('[Model: claude-sonnet-5]\n\n[Provider: Anthropic]\n\n가계부 앱 만들어줘'),
    );
    expect(result.text).toBe('가계부 앱 만들어줘');
  });

  it('strips an inline boltArtifact block', () => {
    const content = `수정해줘<boltArtifact id="x" title="y">\n<boltAction type="file">...</boltAction>\n</boltArtifact>`;
    const result = splitDisplayText(textParts(content));
    expect(result.text).toBe('수정해줘');
  });

  it('cuts the display text at the onboarding marker and counts the additions', () => {
    const content = `가계부 앱 만들어줘${ONBOARDING_ADDITIONS_MARKER}- 이 앱은 만드는 사람 본인만 써요\n- 모바일에서 주로 사용될 앱이에요`;
    const result = splitDisplayText(textParts(content));
    expect(result.text).toBe('가계부 앱 만들어줘');
    expect(result.additionsCount).toBe(2);
  });

  it('only counts lines that actually start with "- " after the marker', () => {
    const content = `프롬프트${ONBOARDING_ADDITIONS_MARKER}- 첫번째\n두번째는 불릿이 아님\n- 세번째`;
    const result = splitDisplayText(textParts(content));
    expect(result.additionsCount).toBe(2);
  });

  it('returns additionsCount 0 when the marker is present but nothing follows it', () => {
    const content = `프롬프트${ONBOARDING_ADDITIONS_MARKER}`;
    const result = splitDisplayText(textParts(content));
    expect(result.text).toBe('프롬프트');
    expect(result.additionsCount).toBe(0);
  });

  it('joins multiple text parts before processing', () => {
    const result = splitDisplayText([
      { type: 'text', text: '가계부 ' },
      { type: 'text', text: '앱 만들어줘' },
    ]);
    expect(result.text).toBe('가계부 앱 만들어줘');
  });

  it('ignores non-text parts entirely', () => {
    const result = splitDisplayText([
      { type: 'text', text: '가계부 앱 만들어줘' },
      { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,xyz' } as any,
    ]);
    expect(result.text).toBe('가계부 앱 만들어줘');
  });

  it('returns empty text and 0 additions for undefined parts', () => {
    expect(splitDisplayText(undefined)).toEqual({ text: '', additionsCount: 0 });
  });

  it('returns empty text and 0 additions for an empty parts array', () => {
    expect(splitDisplayText([])).toEqual({ text: '', additionsCount: 0 });
  });
});
