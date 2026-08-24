import type { MetaFunction } from '@remix-run/cloudflare';
import { LegalPageLayout, LegalSection } from '~/components/legal/LegalPageLayout';

export const meta: MetaFunction = () => {
  return [{ title: '개인정보처리방침 | 코랄레드' }, { name: 'description', content: '코랄레드 개인정보처리방침' }];
};

const EFFECTIVE_DATE = '2026년 8월 19일';
const PRIVACY_OFFICER_NAME = '한성민';
const PRIVACY_OFFICER_EMAIL = 'coralred@coralred.kr';

export default function Privacy() {
  return (
    <LegalPageLayout title="개인정보처리방침" effectiveDate={EFFECTIVE_DATE}>
      <p className="text-bolt-elements-textSecondary">
        코랄레드(이하 "회사")는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등 관련 법령을 준수하고 있습니다.
        회사는 본 개인정보처리방침을 통해 이용자가 제공하는 개인정보가 어떠한 목적과 방식으로 이용되고 있으며, 개인정보
        보호를 위해 어떠한 조치가 취해지고 있는지 안내드립니다. 본 방침은 「이용약관」과는 별개의 독립된 문서이며,
        서비스 이용을 위해서는 두 문서 모두에 동의하셔야 합니다.
      </p>

      <LegalSection title="제1조 (수집하는 개인정보의 항목)">
        <p>회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong className="text-bolt-elements-textPrimary">회원가입 및 로그인 시(필수)</strong>: 이메일 주소
          </li>
          <li>
            <strong className="text-bolt-elements-textPrimary">소셜 로그인(구글, 카카오) 이용 시</strong>: 이름 또는
            닉네임, 프로필 사진 — 각 소셜 서비스로부터 제공에 동의한 범위 내에서 수신
          </li>
          <li>
            <strong className="text-bolt-elements-textPrimary">서비스 이용 과정에서 생성되는 정보</strong>: 채팅 대화
            내용, 이를 통해 생성된 코드 전체 — AI 서비스 제공을 위해 필수적으로 처리됨
          </li>
          <li>
            <strong className="text-bolt-elements-textPrimary">자동으로 수집되는 정보</strong>: 서비스 이용 기록
            (무료/유료 생성 횟수), 접속 로그, 접속 IP 정보
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="제2조 (개인정보의 수집 및 이용 목적)">
        <p>회사는 수집한 개인정보를 다음의 목적을 위해 이용합니다.</p>
        <ul className="list-disc list-inside space-y-1">
          <li>회원 식별 및 관리: 본인 확인, 부정 이용 방지, 회원 문의 응대</li>
          <li>서비스 제공: AI를 활용한 웹사이트/애플리케이션 생성, 채팅 기반 응답 제공</li>
          <li>무료 및 유료 이용량 관리: 생성 횟수 집계, 요금제에 따른 이용 한도 적용</li>
          <li>서비스 개선 및 신규 기능 개발을 위한 통계 분석</li>
        </ul>
      </LegalSection>

      <LegalSection title="제3조 (개인정보의 제3자 제공 및 처리위탁 현황)">
        <p>
          회사는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리업무를 외부 업체에 위탁하거나, 이용자가 직접 정보를
          제공하는 방식으로 제3자와 정보가 공유됩니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse mt-2">
            <thead>
              <tr className="border-b border-bolt-elements-borderColor text-bolt-elements-textPrimary">
                <th className="py-2 pr-4 font-semibold">수탁/제공받는 자</th>
                <th className="py-2 pr-4 font-semibold">처리 목적</th>
                <th className="py-2 pr-4 font-semibold">위탁/제공 항목</th>
                <th className="py-2 font-semibold">근거</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-bolt-elements-borderColor align-top">
                <td className="py-2 pr-4">Supabase, Inc.</td>
                <td className="py-2 pr-4">회원 인증(로그인) 및 데이터베이스 운영</td>
                <td className="py-2 pr-4">이메일, 로그인 세션 정보, 서비스 이용 기록</td>
                <td className="py-2">처리위탁</td>
              </tr>
              <tr className="border-b border-bolt-elements-borderColor align-top">
                <td className="py-2 pr-4">Google LLC</td>
                <td className="py-2 pr-4">소셜 로그인(구글 로그인)</td>
                <td className="py-2 pr-4">이메일, 이름, 프로필 사진</td>
                <td className="py-2">정보주체가 직접 제공</td>
              </tr>
              <tr className="border-b border-bolt-elements-borderColor align-top">
                <td className="py-2 pr-4">Kakao Corp.</td>
                <td className="py-2 pr-4">소셜 로그인(카카오 로그인)</td>
                <td className="py-2 pr-4">이메일, 닉네임, 프로필 사진</td>
                <td className="py-2">정보주체가 직접 제공</td>
              </tr>
              <tr className="border-b border-bolt-elements-borderColor align-top">
                <td className="py-2 pr-4">Anthropic PBC</td>
                <td className="py-2 pr-4">AI 채팅 응답 및 코드 생성 처리</td>
                <td className="py-2 pr-4">채팅 대화 내용, 생성 중인 코드 전체</td>
                <td className="py-2">처리위탁(국외, 미국 소재)</td>
              </tr>
              <tr className="align-top">
                <td className="py-2 pr-4">Resend</td>
                <td className="py-2 pr-4">이메일 인증코드 발송</td>
                <td className="py-2 pr-4">이메일 주소</td>
                <td className="py-2">처리위탁</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Anthropic PBC로 이전되는 정보는 국외(미국)에서 처리됩니다. 이전 항목은 채팅 대화 내용 및 생성 중인 코드
          전체이며, 이전 목적은 AI 응답 생성이고, 서비스 이용 중 실시간으로 이전됩니다. 국외 이전에 동의하지 않으실 경우
          서비스 이용(AI 채팅 및 코드 생성 기능)이 제한될 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="제4조 (개인정보의 보유 및 이용 기간)">
        <p>
          회사는 원칙적으로 개인정보 수집 및 이용 목적이 달성된 후 또는 회원 탈퇴 시 해당 정보를 지체 없이 파기합니다.
          다만, 다음의 정보에 대해서는 아래의 사유로 명시한 기간 동안 보존합니다.
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
          <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
          <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
          <li>서비스 이용 관련 접속 기록: 3개월 (통신비밀보호법)</li>
        </ul>
      </LegalSection>

      <LegalSection title="제5조 (정보주체의 권리와 행사 방법)">
        <p>이용자는 개인정보 주체로서 다음의 권리를 행사할 수 있습니다.</p>
        <ul className="list-disc list-inside space-y-1">
          <li>개인정보 열람 요구</li>
          <li>오류 등이 있을 경우 정정 요구</li>
          <li>삭제 요구</li>
          <li>처리정지 요구</li>
        </ul>
        <p>
          위 권리 행사는 아래 개인정보 보호책임자 이메일로 요청하실 수 있으며, 회사는 관련 법령에 따라 지체 없이
          조치하겠습니다. 서비스 내 설정 화면에서 직접 정정 및 회원 탈퇴(삭제)를 진행하실 수도 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="제6조 (쿠키 및 로컬 저장소 이용 안내)">
        <p>
          회사는 서비스 이용 편의를 위해 이용자의 브라우저에 다음과 같은 정보를 저장합니다. 이 정보는{' '}
          <strong className="text-bolt-elements-textPrimary">
            회사의 서버로 전송되지 않고 이용자의 브라우저에만 저장
          </strong>
          됩니다.
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>화면 테마 설정(라이트/다크 모드)</li>
          <li>마지막으로 입력하던 채팅 프롬프트의 임시 저장 값</li>
          <li>비회원(게스트) 무료 체험 이용 횟수</li>
        </ul>
        <p>
          이용자는 브라우저 설정을 통해 이러한 로컬 저장 정보를 언제든지 삭제할 수 있습니다. 다만 삭제 시 테마 설정이나
          임시 저장된 입력 내용이 초기화될 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="제7조 (개인정보의 안전성 확보 조치)">
        <p>
          회사는 개인정보 보호를 위해 접근 권한 관리, 암호화된 통신(HTTPS), 인증 정보의 안전한 저장 등 기술적·관리적
          조치를 취하고 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="제8조 (개인정보처리방침의 변경)">
        <p>
          본 방침은 관련 법령, 회사 정책 또는 서비스 변경에 따라 수정될 수 있으며, 변경 시 서비스 내 공지사항을 통해
          사전에 고지합니다.
        </p>
      </LegalSection>

      <LegalSection title="제9조 (개인정보 보호책임자)">
        <p>
          회사는 이용자의 개인정보를 보호하고 관련 불만을 처리하기 위해 아래와 같이 개인정보 보호책임자를 지정하고
          있습니다.
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>성명: {PRIVACY_OFFICER_NAME}</li>
          <li>
            이메일:{' '}
            <a href={`mailto:${PRIVACY_OFFICER_EMAIL}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
              {PRIVACY_OFFICER_EMAIL}
            </a>
          </li>
        </ul>
      </LegalSection>
    </LegalPageLayout>
  );
}
