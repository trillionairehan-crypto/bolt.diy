import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 한국어 문구, 3회차) — 채팅창에서 프로바이더별 API 키를 입력할 때
 * 항상 노출되는 APIKeyManager.tsx의 라벨/상태 문구/placeholder/버튼 title이 전부 영어로
 * 하드코딩돼 있던 문제. OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('APIKeyManager — 라벨/상태 문구/버튼 title이 한국어다', () => {
  const source = readFileSync(join(__dirname, 'components/chat/APIKeyManager.tsx'), 'utf-8');

  it('영어 하드코딩 문구가 남아있지 않다', () => {
    expect(source).not.toContain('API Key:');
    expect(source).not.toContain('Set via UI');
    expect(source).not.toContain('Set via environment variable');
    expect(source).not.toContain('Not Set (Please set via UI or ENV_VAR)');
    expect(source).not.toContain('Enter API Key');
    expect(source).not.toContain('Save API Key');
    expect(source).not.toContain('title="Cancel"');
    expect(source).not.toContain('Edit API Key');
    expect(source).not.toContain("'Get API Key'");
    expect(source).not.toContain('title="Get API Key"');
  });

  it('한국어 라벨/상태 문구/버튼 title로 번역돼 있다', () => {
    expect(source).toContain('API 키:');
    expect(source).toContain('화면에서 설정됨');
    expect(source).toContain('환경 변수로 설정됨');
    expect(source).toContain('설정 안 됨 (화면 또는 환경 변수로 설정해 주세요)');
    expect(source).toContain('API 키 입력');
    expect(source).toContain('API 키 저장');
    expect(source).toContain('title="취소"');
    expect(source).toContain('API 키 수정');
    expect(source).toContain('API 키 발급받기');
  });
});
