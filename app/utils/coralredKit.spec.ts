import { describe, expect, it } from 'vitest';
import { CORALRED_BOLT_PROMPT } from './coralredKit';

/*
 * 실측(2026-09-02, 배달 플랫폼 생성물): CORALRED_BOLT_PROMPT가 ".bolt/prompt" 파일로 매 템플릿
 * 임포트마다 주입되는데(api.github-template.ts/selectStarterTemplate.ts 둘 다), 예전 문구가
 * "Use stock photos from Pexels (NEVER Unsplash)"로 실사진 스톡 URL을 대놓고 권장하고 있었다 —
 * new-prompt.ts의 "절대 스톡 URL 금지" 규칙과 직접 충돌했고, 실제로 그 문구를 따라 이미지 자리에
 * pexels.com URL을 쓴 생성물이 나왔다(3회 검증 생성 중 1회, 3회 다 이 문구를 받았다).
 */
describe('CORALRED_BOLT_PROMPT — 이미지 플레이스홀더 규칙과 충돌하지 않는다', () => {
  it('Pexels/Unsplash를 "쓰라"고 하지 않는다 — 언급되더라도 금지 목록 안이어야 한다', () => {
    expect(CORALRED_BOLT_PROMPT).not.toMatch(/use stock photos from pexels/i);
    expect(CORALRED_BOLT_PROMPT).not.toMatch(/stock photos.{0,20}(pexels|unsplash)/i);
  });

  it('스톡/플레이스홀더 서비스 URL을 명시적으로 금지한다', () => {
    expect(CORALRED_BOLT_PROMPT).toMatch(/stock-photo|placeholder-service/i);
  });

  it('코랄레드 이미지 플레이스홀더 패턴(캡션 문구)을 가리킨다', () => {
    expect(CORALRED_BOLT_PROMPT).toContain('사진을 보내주시면 여기에 넣어드릴게요');
  });
});
