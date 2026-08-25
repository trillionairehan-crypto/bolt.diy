import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 한국어 문구) — 모델/프로바이더 선택 드롭다운(매 모델
 * 전환마다 열리는 핵심 표면)과 코드 블록 복사 버튼(AI가 생성하는 거의 모든 코드 블록에 노출)의
 * placeholder/aria-label/title이 영어로 하드코딩돼 있던 문제. OVERNIGHT5_PROGRESS.md 참고.
 */
describe('모델 선택기/코드 블록의 사용자 노출 문구가 한국어다', () => {
  it('ModelSelector.tsx 프로바이더 검색 입력창 문구가 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/chat/ModelSelector.tsx'), 'utf-8');
    expect(source).not.toContain('placeholder="Search providers... (⌘K to clear)"');
    expect(source).not.toContain('aria-label="Search providers"');
    expect(source).toContain('placeholder="프로바이더 검색... (⌘K로 지우기)"');
    expect(source).toContain('aria-label="프로바이더 검색"');
  });

  it('ModelSelector.tsx 모델 검색 입력창 문구가 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/chat/ModelSelector.tsx'), 'utf-8');
    expect(source).not.toContain('placeholder="Search models... (⌘K to clear)"');
    expect(source).not.toContain('aria-label="Search models"');
    expect(source).toContain('placeholder="모델 검색... (⌘K로 지우기)"');
    expect(source).toContain('aria-label="모델 검색"');
  });

  it('ModelSelector.tsx 검색어 지우기 버튼과 모델 배지 title이 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/chat/ModelSelector.tsx'), 'utf-8');
    expect(source).not.toContain('aria-label="Clear search"');
    expect(source).not.toContain('title="Free model"');
    expect(source).not.toContain('title="Selected"');

    const clearSearchCount = source.split('aria-label="검색어 지우기"').length - 1;
    expect(clearSearchCount).toBe(2);
    expect(source).toContain('title="무료 모델"');
    expect(source).toContain('title="선택됨"');
  });

  it('CodeBlock.tsx 복사 버튼 title이 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/chat/CodeBlock.tsx'), 'utf-8');
    expect(source).not.toContain('title="Copy Code"');
    expect(source).toContain('title="코드 복사"');
  });

  it('ModelSelector.tsx 무료/유료 모델 필터 문구가 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/chat/ModelSelector.tsx'), 'utf-8');
    expect(source).not.toContain('Free models only');
    expect(source).not.toContain('} free model{');
    expect(source).not.toContain('model(s) found');
    expect(source).not.toContain('showing best matches');
    expect(source).toContain('무료 모델만');
    expect(source).toContain('무료 모델 {filteredModels.length}개');
    expect(source).toContain('가장 잘 맞는 항목만 표시');
  });

  it('ModelSelector.tsx 모델 목록 로딩/빈 상태 문구가 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/chat/ModelSelector.tsx'), 'utf-8');
    expect(source).not.toContain('Loading models...');
    expect(source).not.toContain('No models match');
    expect(source).not.toContain('No free models available');
    expect(source).not.toContain('No models found');
    expect(source).not.toContain('No models available');
    expect(source).not.toContain('Try searching for model names');
    expect(source).not.toContain('Try disabling the "Free models only" filter');
    expect(source).toContain('모델을 불러오는 중...');
    expect(source).toContain('사용 가능한 무료 모델이 없어요');
    expect(source).toContain('"무료 모델만" 필터를 꺼서 모든 모델을 볼 수 있어요');
  });
});
