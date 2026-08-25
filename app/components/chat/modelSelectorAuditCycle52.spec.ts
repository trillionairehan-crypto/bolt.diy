import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ModelSelector.tsx's search-result-count line claimed "가장 잘 맞는 항목만 표시"
 * (only best matches shown) whenever more than 5 models matched, but
 * filteredModels is never sliced anywhere — the .map() right below renders
 * every match. The claim was simply false, so it's removed rather than
 * implemented (implementing a real limit would change filtering behavior).
 */
describe('ModelSelector.tsx search result count text matches actual behavior', () => {
  it('does not claim results are truncated to best matches', () => {
    const source = readFileSync(join(__dirname, 'ModelSelector.tsx'), 'utf-8');
    expect(source).not.toContain('가장 잘 맞는 항목만 표시');
  });

  it('still shows the match count', () => {
    const source = readFileSync(join(__dirname, 'ModelSelector.tsx'), 'utf-8');
    expect(source).toContain('모델 {filteredModels.length}개 찾음');
  });
});

/**
 * The per-model fuzzy-match score badge was hardcoded English ("87% match")
 * while every other string in this component is Korean.
 */
describe('ModelSelector.tsx match score badge is translated', () => {
  it('does not use the English "match" label', () => {
    const source = readFileSync(join(__dirname, 'ModelSelector.tsx'), 'utf-8');
    expect(source).not.toMatch(/% match/);
  });

  it('uses the Korean "일치율" label instead', () => {
    const source = readFileSync(join(__dirname, 'ModelSelector.tsx'), 'utf-8');
    expect(source).toContain('일치율 {(modelOption as any).searchScore.toFixed(0)}%');
  });
});

/**
 * Switching providers only reset showFreeModelsOnly, not modelSearchQuery —
 * a leftover search term from the previous provider (e.g. "llama" while on
 * OpenRouter) would carry over to the newly selected provider and could
 * incorrectly show "사용 가능한 모델이 없어요" even though models exist.
 */
describe('ModelSelector.tsx resets model search when provider changes', () => {
  it('clears modelSearchQuery in the same effect that resets showFreeModelsOnly on provider change', () => {
    const source = readFileSync(join(__dirname, 'ModelSelector.tsx'), 'utf-8');
    const effectMatch = source.match(
      /useEffect\(\(\) => \{\s*setShowFreeModelsOnly\(false\);\s*setModelSearchQuery\(''\);\s*setDebouncedModelSearchQuery\(''\);\s*\}, \[provider\?\.name\]\);/,
    );
    expect(effectMatch).not.toBeNull();
  });
});
