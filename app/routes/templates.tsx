import type { LinksFunction, MetaFunction } from '@remix-run/cloudflare';
import { Logo } from '~/components/ui/Logo';
import coralredUiCssUrl from '~design-handoff/coralred-ui.css?url';

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: coralredUiCssUrl }];

export const meta: MetaFunction = () => {
  return [
    { title: '템플릿 | 코랄레드' },
    { name: 'description', content: '자주 만드는 앱 8가지 중 하나로 골라서 바로 시작해요' },
  ];
};

interface TileSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  tone: 'accent' | 'soft' | 'border';
}

interface TemplateSpec {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  prompt: string;
  tiles: TileSpec[];
}

const TONE_FILL: Record<TileSpec['tone'], string> = {
  accent: 'var(--accent)',
  soft: 'var(--accent-soft)',
  border: 'var(--border-strong)',
};

function TemplateGlyph({ tiles }: { tiles: TileSpec[] }) {
  return (
    <svg viewBox="0 0 64 64" width={40} height={40} aria-hidden="true">
      {tiles.map((tile, index) => (
        <rect
          key={index}
          x={tile.x}
          y={tile.y}
          width={tile.w}
          height={tile.h}
          rx={tile.r}
          fill={TONE_FILL[tile.tone]}
        />
      ))}
    </svg>
  );
}

const TEMPLATES: TemplateSpec[] = [
  {
    slug: 'reservation',
    name: '가게 예약',
    description: '손님이 직접 날짜와 시간을 골라 예약하고, 사장님은 한눈에 확인해요.',
    tags: ['예약', '캘린더', '알림'],
    prompt:
      '미용실 예약 사이트 만들어줘. 손님이 날짜랑 시간을 골라서 예약하고, 예약 목록을 사장님이 볼 수 있는 관리 화면도 있었으면 좋겠어.',
    tiles: [
      { x: 8, y: 8, w: 48, h: 12, r: 4, tone: 'accent' },
      { x: 8, y: 26, w: 14, h: 14, r: 4, tone: 'soft' },
      { x: 25, y: 26, w: 14, h: 14, r: 4, tone: 'border' },
      { x: 42, y: 26, w: 14, h: 14, r: 4, tone: 'soft' },
      { x: 8, y: 44, w: 14, h: 12, r: 4, tone: 'border' },
      { x: 25, y: 44, w: 14, h: 12, r: 4, tone: 'accent' },
    ],
  },
  {
    slug: 'inventory',
    name: '재고 관리',
    description: '제품이 들어오고 나가는 걸 기록하고, 부족한 재고는 바로 눈에 띄어요.',
    tags: ['재고', '목록', '알림'],
    prompt:
      '작은 가게 재고 관리 앱 만들어줘. 제품을 추가하고 입고/출고 수량을 기록하고, 재고가 부족한 제품은 목록 위쪽에 표시해줘.',
    tiles: [
      { x: 10, y: 10, w: 20, h: 20, r: 5, tone: 'soft' },
      { x: 34, y: 10, w: 20, h: 20, r: 5, tone: 'border' },
      { x: 10, y: 34, w: 20, h: 20, r: 5, tone: 'border' },
      { x: 34, y: 34, w: 20, h: 20, r: 5, tone: 'accent' },
    ],
  },
  {
    slug: 'membership',
    name: '회원 관리',
    description: '회원 정보와 등급을 정리하고, 만료가 가까운 회원을 챙겨요.',
    tags: ['회원', '등급', '목록'],
    prompt:
      '헬스장 회원 관리 앱 만들어줘. 회원 이름, 연락처, 등록 기간을 저장하고, 만료가 임박한 회원은 목록에서 눈에 띄게 보여줘.',
    tiles: [
      { x: 22, y: 8, w: 20, h: 20, r: 10, tone: 'accent' },
      { x: 8, y: 36, w: 20, h: 20, r: 10, tone: 'soft' },
      { x: 36, y: 36, w: 20, h: 20, r: 10, tone: 'border' },
    ],
  },
  {
    slug: 'portfolio',
    name: '포트폴리오',
    description: '작업물을 깔끔하게 모아 보여주는 나만의 소개 페이지예요.',
    tags: ['소개', '갤러리', '반응형'],
    prompt:
      '내 작업물을 소개하는 포트폴리오 사이트 만들어줘. 프로젝트를 카드로 나열하고, 클릭하면 자세한 설명이 나오게 해줘.',
    tiles: [
      { x: 8, y: 8, w: 48, h: 26, r: 5, tone: 'soft' },
      { x: 8, y: 40, w: 22, h: 16, r: 4, tone: 'border' },
      { x: 34, y: 40, w: 22, h: 16, r: 4, tone: 'accent' },
    ],
  },
  {
    slug: 'survey',
    name: '설문',
    description: '질문 몇 개로 응답을 받고, 결과를 그래프로 바로 확인해요.',
    tags: ['설문', '응답', '통계'],
    prompt:
      '간단한 설문조사 사이트 만들어줘. 객관식/주관식 질문을 만들고, 응답이 쌓이면 결과를 그래프로 보여줬으면 좋겠어.',
    tiles: [
      { x: 8, y: 10, w: 48, h: 8, r: 4, tone: 'border' },
      { x: 8, y: 24, w: 48, h: 8, r: 4, tone: 'soft' },
      { x: 8, y: 38, w: 30, h: 8, r: 4, tone: 'accent' },
      { x: 8, y: 52, w: 18, h: 4, r: 2, tone: 'border' },
    ],
  },
  {
    slug: 'group-dues',
    name: '모임 회비 정산',
    description: '누가 얼마 냈는지, 얼마 남았는지 모임 회비를 투명하게 관리해요.',
    tags: ['정산', '회비', '모임'],
    prompt: '동호회 회비 관리 앱 만들어줘. 회원별 납부 내역을 기록하고, 이번 달 남은 잔액이랑 지출 내역도 보여줘.',
    tiles: [
      { x: 14, y: 8, w: 22, h: 22, r: 11, tone: 'accent' },
      { x: 30, y: 24, w: 22, h: 22, r: 11, tone: 'soft' },
      { x: 8, y: 40, w: 48, h: 12, r: 5, tone: 'border' },
    ],
  },
  {
    slug: 'dashboard',
    name: '대시보드',
    description: '숫자와 지표를 한 화면에 모아, 흐름을 한눈에 파악해요.',
    tags: ['지표', '차트', '요약'],
    prompt:
      '매출 현황을 보여주는 대시보드 만들어줘. 이번 달 매출, 지난달 대비 증감, 일별 매출 그래프를 한 화면에 보여줘.',
    tiles: [
      { x: 8, y: 36, w: 10, h: 20, r: 3, tone: 'border' },
      { x: 22, y: 24, w: 10, h: 32, r: 3, tone: 'soft' },
      { x: 36, y: 12, w: 10, h: 44, r: 3, tone: 'accent' },
      { x: 50, y: 28, w: 6, h: 28, r: 3, tone: 'border' },
    ],
  },
  {
    slug: 'blog',
    name: '블로그',
    description: '글을 쓰고 태그로 정리하는, 나만의 기록 공간이에요.',
    tags: ['글쓰기', '태그', '기록'],
    prompt: '개인 블로그 만들어줘. 글을 쓰고 태그를 붙일 수 있고, 태그별로 글을 모아볼 수 있게 해줘.',
    tiles: [
      { x: 8, y: 8, w: 48, h: 6, r: 3, tone: 'accent' },
      { x: 8, y: 20, w: 48, h: 4, r: 2, tone: 'border' },
      { x: 8, y: 28, w: 48, h: 4, r: 2, tone: 'border' },
      { x: 8, y: 36, w: 32, h: 4, r: 2, tone: 'border' },
      { x: 8, y: 48, w: 16, h: 8, r: 4, tone: 'soft' },
    ],
  },
];

export default function Templates() {
  return (
    <div className="cr-page" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <style>{`
        .cr-templates-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 900px) {
          .cr-templates-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .cr-templates-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <a href="/" className="cr-row-8" style={{ width: 'fit-content' }}>
        <Logo height={24} showWordmark={false} />
      </a>

      <section className="cr-section cr-stack-16" style={{ paddingBottom: 32 }}>
        <span className="cr-eyebrow">TEMPLATES</span>
        <h1 className="cr-display">템플릿으로 시작해요</h1>
        <p className="cr-body">자주 만드는 앱 8가지예요. 마음에 드는 걸 고르면 바로 만들기 시작할 수 있어요.</p>
      </section>

      <section className="cr-templates-grid">
        {TEMPLATES.map((template) => (
          <div key={template.slug} className="cr-card cr-stack-16">
            <div
              style={{
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TemplateGlyph tiles={template.tiles} />
            </div>
            <div className="cr-stack-8">
              <h2 className="cr-h2">{template.name}</h2>
              <p className="cr-body" style={{ color: 'var(--muted)' }}>
                {template.description}
              </p>
            </div>
            <div className="cr-row-8" style={{ flexWrap: 'wrap', gap: 6 }}>
              {template.tags.map((tag) => (
                <span key={tag} className="cr-badge">
                  {tag}
                </span>
              ))}
            </div>
            <a
              href={`/?prompt=${encodeURIComponent(template.prompt)}`}
              className="cr-btn"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              이 템플릿으로 시작
            </a>
          </div>
        ))}
      </section>

      <footer className="cr-stack-8" style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginTop: 48 }}>
        <p className="cr-caption">코랄레드 · 대표자 한성민 · 사업자등록번호 383-23-02498</p>
        <p className="cr-caption">경기도 여주시 가남읍 심석2길 50-6 · coralred.kr</p>
        <p className="cr-caption">
          <a href="mailto:coralred@coralred.kr" className="cr-mono">
            coralred@coralred.kr
          </a>{' '}
          ·{' '}
          <a href="/terms" className="cr-mono">
            이용약관
          </a>{' '}
          ·{' '}
          <a href="/privacy" className="cr-mono">
            개인정보처리방침
          </a>
        </p>
      </footer>
    </div>
  );
}
