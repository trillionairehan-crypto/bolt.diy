import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 온보딩) — ScrollToBottom 버튼(BaseChat.tsx)과
 * URL 가져오기 팝오버(WebSearch.client.tsx)의 버튼 라벨·토스트 문구가
 * 전부 영어로 하드코딩돼 있던 문제. OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('BaseChat — "마지막 메시지로 이동" 버튼 문구가 한국어다', () => {
  const source = readFileSync(join(__dirname, 'components/chat/BaseChat.tsx'), 'utf-8');

  it('영어 하드코딩 문구가 남아있지 않다', () => {
    expect(source).not.toContain('Go to last message');
  });

  it('한국어 문구로 번역돼 있다', () => {
    expect(source).toContain('마지막 메시지로 이동');
  });
});

describe('WebSearch — URL 가져오기 팝오버 버튼/토스트 문구가 한국어다', () => {
  const source = readFileSync(join(__dirname, 'components/chat/WebSearch.client.tsx'), 'utf-8');

  it('영어 하드코딩 문구가 남아있지 않다', () => {
    expect(source).not.toContain('Failed to fetch URL content');
    expect(source).not.toContain('URL content fetched');
    expect(source).not.toContain("'Failed to fetch URL'");
    expect(source).not.toContain('Fetching...');
    expect(source).not.toContain("'Fetch'");
  });

  it('한국어 문구로 번역돼 있다', () => {
    expect(source).toContain('웹페이지 내용을 가져오지 못했어요');
    expect(source).toContain('웹페이지 내용을 가져왔어요');
    expect(source).toContain('주소를 가져오지 못했어요');
    expect(source).toContain('가져오는 중...');
    expect(source).toContain('가져오기');
  });
});
