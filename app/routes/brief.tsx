import type { LinksFunction, MetaFunction } from '@remix-run/cloudflare';
import { useState } from 'react';
import { DeepBrief } from '~/components/brief/DeepBrief';
import type { DirectionSheet } from '~/lib/onboarding/brief-schema';
import coralredUiCssUrl from '~design-handoff/coralred-ui.css?url';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: coralredUiCssUrl },
  { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700&display=swap' },
];

export const meta: MetaFunction = () => [
  { title: '딥 브리프 미리보기 | 코랄레드' },
  { name: 'robots', content: 'noindex' },
];

/**
 * 딥 브리프(온보딩 v2) 미리보기 — 기존 채팅 온보딩(PromptClarification)과 분리된 라우트.
 * 완료하면 Direction Sheet JSON을 화면에 보여준다(아직 생성 파이프라인에 연결하지 않음).
 */
export default function BriefPreview() {
  const [sheet, setSheet] = useState<DirectionSheet | null>(null);

  if (sheet) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px', fontFamily: 'ui-monospace, monospace' }}>
        <h1 style={{ fontFamily: 'inherit', fontSize: 18 }}>Direction Sheet v{sheet.version}</h1>
        <p style={{ fontSize: 13, color: '#6e645b' }}>
          원형 {sheet.decided.archetype} · 세계관 {sheet.brief.world.styleLock} · 예상 ${sheet.decided.estimate.usd}
        </p>
        <pre style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {JSON.stringify(
            sheet,
            (k, v) => (k === 'url' && typeof v === 'string' && v.startsWith('blob:') ? '(blob)' : v),
            2,
          )}
        </pre>
        <button type="button" onClick={() => setSheet(null)} style={{ font: 'inherit', padding: '8px 14px' }}>
          ← 브리프로 돌아가기
        </button>
      </div>
    );
  }

  return <DeepBrief onComplete={setSheet} />;
}
