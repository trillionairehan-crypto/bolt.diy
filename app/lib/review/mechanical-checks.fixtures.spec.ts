/**
 * 실제 골격 7 생성물(브라우저 CDP로 캡처, tests/fixtures/generated/*.json)을 픽스처로 쓰는 회귀
 * 테스트. mechanical-checks 규칙을 바꿀 때 실 생성을 다시 돌리지 않고 이 픽스처로만 검증하기 위한
 * 것 — 각 파일은 { "/home/project/...": "내용", ... } 형태의 파일맵 그대로다(캡처 당시
 * workbenchStore.files.get() 덤프).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveHueFromFiles, runMechanicalChecks } from './mechanical-checks';

const FIXTURES_DIR = path.resolve(__dirname, '../../../tests/fixtures/generated');

function loadFixture(name: string): Record<string, string> {
  const raw = readFileSync(path.join(FIXTURES_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw);
}

describe('mechanical-checks against captured 골격 7 생성물 (bakery, 2026-09-03)', () => {
  const files = loadFixture('bakery');
  const hue = resolveHueFromFiles(files);

  it('resolves --hue from index.html', () => {
    expect(hue).toBe(33);
  });

  it('runs without throwing and returns a stable shape', () => {
    const { findings, updatedFiles } = runMechanicalChecks(files, hue);
    expect(Array.isArray(findings)).toBe(true);
    expect(typeof updatedFiles).toBe('object');
  });

  it('leaves the already-correct hero/ch1/ch2/ch3 data-slot order untouched (bakery got this right at capture time)', () => {
    const appTsx = files['/home/project/src/App.tsx'];
    const { findings } = runMechanicalChecks(files, hue);
    expect(appTsx).toContain('data-slot="hero"');
    expect(appTsx).toContain('data-slot="ch1"');
    expect(appTsx).toContain('data-slot="ch2"');
    expect(appTsx).toContain('data-slot="ch3"');
    expect(findings.some((f) => f.rule === 'skeleton7-data-slot' || f.rule === 'skeleton7-chapter-count')).toBe(false);
  });

  it('does not flag the hero caption as duplicated (single occurrence in this capture)', () => {
    const { findings } = runMechanicalChecks(files, hue);
    expect(findings.some((f) => f.rule === 'skeleton7-hero-caption-dedupe')).toBe(false);
  });

  it('does not detect a card-grid/.map() violation inside a chapter (bakery wrote 4 chapters directly)', () => {
    const { findings } = runMechanicalChecks(files, hue);
    expect(findings.some((f) => f.rule === 'skeleton7-card-grid-detected')).toBe(false);
  });
});

describe('mechanical-checks against captured 골격 7 생성물 (portfolio, 2026-09-04 — new-prompt.ts 문구 변경 검증용)', () => {
  const files = loadFixture('portfolio');
  const hue = resolveHueFromFiles(files);

  it('resolves --hue from index.html', () => {
    expect(hue).toBe(33);
  });

  it('gets hero/ch1/ch2/ch3 data-slot naming right on first try (new prompt wording works)', () => {
    const { findings } = runMechanicalChecks(files, hue);
    expect(findings.some((f) => f.rule === 'skeleton7-data-slot' || f.rule === 'skeleton7-chapter-count')).toBe(false);
  });

  it('writes the 3 works directly (works[0]/works[1]/works[2]) instead of .map()ing them — confirms the new "재사용 컴포넌트로 묶지 않는다" wording held', () => {
    const appTsx = files['/home/project/src/App.tsx'];
    expect(appTsx).not.toMatch(/works\s*\.\s*map\(/);
    expect(appTsx).toContain('works[0]');
    expect(appTsx).toContain('works[1]');
    expect(appTsx).toContain('works[2]');

    const { findings } = runMechanicalChecks(files, hue);
    expect(findings.some((f) => f.rule === 'skeleton7-card-grid-detected')).toBe(false);
  });

  it('does not flag the hero caption as duplicated', () => {
    const { findings } = runMechanicalChecks(files, hue);
    expect(findings.some((f) => f.rule === 'skeleton7-hero-caption-dedupe')).toBe(false);
  });

  it('keeps fallback headlines at 56px without needing a fix', () => {
    const { findings } = runMechanicalChecks(files, hue);
    expect(findings.some((f) => f.rule === 'skeleton7-fallback-headline-size' && f.autoFixed)).toBe(false);
  });
});

describe('mechanical-checks against captured 골격 7 생성물 (cafe, 2026-09-04 — new-prompt.ts 문구 변경 검증용)', () => {
  const files = loadFixture('cafe');
  const hue = resolveHueFromFiles(files);

  it('gets hero/ch1/ch2/ch3 data-slot naming right', () => {
    const { findings } = runMechanicalChecks(files, hue);
    expect(findings.some((f) => f.rule === 'skeleton7-data-slot' || f.rule === 'skeleton7-chapter-count')).toBe(false);
  });

  /*
   * 실측(이 픽스처, 2026-09-04): "이미지 없음" 처리를 재사용하지 말라는 프롬프트 문구에도 불구하고
   * PhotoSlot.tsx라는 공용 컴포넌트를 만들어 4개 챕터 전부에서 호출했다 — 렌더된 DOM에는 안내
   * 문구가 4회 나오지만(inspect.json captionCount:4), 소스 문자열 자체는 PhotoSlot.tsx 안에 1번만
   * 있다. runSkeleton7CaptionDedupeCheck는 파일별 리터럴 문자열 개수만 세므로 이 케이스를 못 잡는다
   * — 알려진 사각지대. 여기서는 그 사각지대를 문서화만 하고 고치지는 않는다(별도 작업).
   */
  it('KNOWN GAP: caption duplicated via a reused component (PhotoSlot.tsx) is invisible to the source-level dedupe check', () => {
    const appTsx = files['/home/project/src/App.tsx'];
    const photoSlot = files['/home/project/src/components/PhotoSlot.tsx'];
    const CAPTION = '사진을 보내주시면 여기에 넣어드릴게요';

    expect(appTsx.split(CAPTION).length - 1).toBe(0); // App.tsx 자체엔 리터럴이 없다
    expect(photoSlot.split(CAPTION).length - 1).toBe(1); // PhotoSlot.tsx 안에 1번 — 재사용 컴포넌트 존재 자체가 문제

    const { findings } = runMechanicalChecks(files, hue);
    expect(findings.some((f) => f.rule === 'skeleton7-hero-caption-dedupe')).toBe(false); // 못 잡음 — 사각지대
  });

  it('does not detect a card-grid/.map() violation', () => {
    const { findings } = runMechanicalChecks(files, hue);
    expect(findings.some((f) => f.rule === 'skeleton7-card-grid-detected')).toBe(false);
  });
});
