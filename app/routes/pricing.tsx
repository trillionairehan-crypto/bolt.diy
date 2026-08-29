import type { LinksFunction, MetaFunction } from '@remix-run/cloudflare';
import { Check } from 'lucide-react';
import { Logo } from '~/components/ui/Logo';
import coralredUiCssUrl from '~design-handoff/coralred-ui.css?url';

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: coralredUiCssUrl }];

export const meta: MetaFunction = () => {
  return [{ title: '요금제 | 코랄레드' }, { name: 'description', content: '코랄레드 요금제 안내' }];
};

interface PricingPlan {
  name: string;
  priceMonthly: number;
  messagesPerMonth: number;
  carryOver: boolean;
  brandingRemoved: boolean;
  customBrandColor: boolean;

  /** Coral opacity (0-1) — the only signal of plan hierarchy; matches the landing page's tiers. */
  intensity: number;
}

const PLANS: PricingPlan[] = [
  {
    name: 'Free',
    priceMonthly: 0,
    messagesPerMonth: 10,
    carryOver: false,
    brandingRemoved: false,
    customBrandColor: false,
    intensity: 0.18,
  },
  {
    name: 'Light',
    priceMonthly: 9900,
    messagesPerMonth: 35,
    carryOver: true,
    brandingRemoved: false,
    customBrandColor: false,
    intensity: 0.4,
  },
  {
    name: 'Pro',
    priceMonthly: 29900,
    messagesPerMonth: 100,
    carryOver: true,
    brandingRemoved: true,
    customBrandColor: true,
    intensity: 0.65,
  },
  {
    name: 'Max',
    priceMonthly: 79900,
    messagesPerMonth: 300,
    carryOver: true,
    brandingRemoved: true,
    customBrandColor: true,
    intensity: 1,
  },
];

function planFeatures(plan: PricingPlan): string[] {
  const features = [`월 메시지 ${plan.messagesPerMonth}건`];

  if (plan.carryOver) {
    features.push(`이월 (다음 달 최대 메시지 ${plan.messagesPerMonth * 2}건까지 누적)`);
  }

  features.push(plan.brandingRemoved ? '코랄레드 브랜딩 완전 제거' : '코랄레드 브랜딩 표시');

  if (plan.customBrandColor) {
    features.push('커스텀 브랜드 색상');
  }

  return features;
}

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: '메시지가 뭔가요?',
    a: '사용자가 채팅으로 보내는 요청 1건을 의미해요. AI가 미리보기 오류를 감지해 스스로 고치는 자동 수정은 메시지 횟수에서 차감되지 않아요.',
  },
  {
    q: '안 쓴 메시지는 어떻게 되나요?',
    a: '유료 플랜은 그 달 다 쓰지 못한 메시지가 다음 달로 이월돼요. 다만 무한정 쌓이지는 않고, 월 할당량의 최대 2배까지만 누적돼요.',
  },
  {
    q: '브랜딩 제거가 뭔가요?',
    a: 'Free · Light 플랜으로 만든 앱에는 코랄레드로 만들었다는 표시가 남아요. Pro 이상에서는 이 표시가 완전히 제거되고, 브랜드 색상도 직접 지정할 수 있어요.',
  },
  {
    q: '환불은 어떻게 하나요?',
    a: (
      <>
        결제일로부터 7일 이내 미사용 시 전액 환불되며, 그 외의 경우에도 관련 법령에 따라 환불받을 수 있어요. 자세한
        절차는{' '}
        <a href="/terms" className="cr-mono">
          이용약관
        </a>
        에서 확인하실 수 있어요.
      </>
    ),
  },
];

export default function Pricing() {
  return (
    <div className="cr-page" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <style>{`
        @media (max-width: 760px) {
          .cr-grid-4 { grid-template-columns: 1fr; }
        }
      `}</style>

      <a href="/" className="cr-row-8" style={{ width: 'fit-content' }}>
        <Logo height={24} />
      </a>

      <section className="cr-section cr-stack-16" style={{ paddingBottom: 48 }}>
        <span className="cr-eyebrow">PRICING</span>
        <h1 className="cr-display">코랄레드 요금제</h1>
        <p className="cr-body">필요한 만큼만, 부담 없이 시작하세요.</p>
      </section>

      <section>
        <div className="cr-grid-4">
          {PLANS.map((plan) => (
            <div key={plan.name} className="cr-card cr-stack-16" style={{ position: 'relative', overflow: 'hidden' }}>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: `rgba(255, 83, 48, ${plan.intensity})`,
                }}
              />
              <div className="cr-stack-4">
                <span className="cr-eyebrow">{plan.name}</span>
                <div className="cr-row-8" style={{ alignItems: 'baseline' }}>
                  <span className="cr-h1">
                    {plan.priceMonthly === 0 ? '0원' : `${plan.priceMonthly.toLocaleString('ko-KR')}원`}
                  </span>
                  {plan.priceMonthly > 0 ? <span className="cr-caption">/ 월</span> : null}
                </div>
              </div>
              <ul className="cr-stack-8" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {planFeatures(plan).map((feature) => (
                  <li key={feature} className="cr-body cr-row-8">
                    <Check size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    {feature}
                  </li>
                ))}
              </ul>
              <a href="/" className="cr-btn outline" style={{ justifyContent: 'center' }}>
                시작하기
              </a>
            </div>
          ))}
        </div>

        <div className="cr-stack-8" style={{ marginTop: 24 }}>
          <p className="cr-caption">모든 플랜에서 AI 자동 수정은 메시지에서 차감되지 않아요.</p>
          <p className="cr-caption">연간 결제 시 2개월 무료 (약 17% 할인) · 표기된 가격은 부가세 포함가입니다.</p>
        </div>
      </section>

      <section className="cr-section cr-stack-24" style={{ paddingTop: 64, paddingBottom: 48 }}>
        <h2 className="cr-h1">자주 묻는 질문</h2>
        <div className="cr-stack-24">
          {FAQS.map((faq) => (
            <div key={faq.q} className="cr-stack-8">
              <p className="cr-body" style={{ fontWeight: 600 }}>
                {faq.q}
              </p>
              <p className="cr-body" style={{ color: 'var(--muted)' }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer
        className="cr-stack-8"
        style={{ borderTop: '1px solid var(--border)', paddingTop: 24, paddingBottom: 48 }}
      >
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
