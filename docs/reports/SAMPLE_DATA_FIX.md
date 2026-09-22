# 코랄레드 — 샘플 데이터 정합성 재발 수정 보고서

작업일: 2026-08-29
브랜치: `overnight5`
대상 파일: `app/lib/common/prompts/new-prompt.ts`

---

## 전/후 문구

### 전 (`Starting Data`, 3차 보강 때 넣은 문구)
> Pick the items so every derived number (balance, total, points) computes correctly from them
> AND lands positive — work backward from a natural positive headline number to the line items,
> not the other way around. A headline metric that reads 0 or negative on first load is a
> failure.

"거꾸로(work backward) 만들어라"고 방향만 알려줬지, **거꾸로 만드는 절차 자체**는 안
적었습니다. "이렇게 하면 실패다"는 있었지만 "정확히 이 순서로 하면 된다"는 없었던
셈이라, 모델이 매번 같은 순서를 따른다는 보장이 없었습니다 — 그래서 같은 프롬프트를
두 번 넣었을 때 한 번은 70P(정상), 한 번은 -1,900P(실패)로 결과가 갈렸던 것으로
보입니다.

### 후
> Build the items by this exact procedure, not free-form — picking items first and hoping the
> total lands positive fails often enough to be a real bug: (1) pick a natural positive target
> for the headline number (balance/total/points) FIRST. (2) work backward: write add/earn items
> and subtract/spend/refund items that sum to that target — never the other order. (3)
> subtract-type items' total must not exceed half of add-type items' total. (4) actually add up
> the items you wrote and confirm the sum equals the target — a mismatch means fixing the items,
> not the target. A headline metric that reads 0 or negative on first load is a failure
> regardless of how it got there.

요청하신 "목표값 → 역산 → 검산" 순서를 번호 붙은 4단계로 못 박았고, 그 사이에 "차감류
합계가 적립류 합계의 절반을 넘지 않는다"는 수치 제약도 넣었습니다 — 이게 있으면
"적립 800 vs 환급 3,000" 같은, 애초에 목표값을 훨씬 웃도는 차감 항목 자체가 절차상
못 나옵니다.

### 자가 점검 항목도 갱신
**전**: `Sample data is visible on the first screen (...), and its headline number is positive,
not 0 or negative.` — "양수인지 봐라"까지만.
**후**: `Manually add up the sample items and confirm the sum matches the headline number shown
AND is positive.` — 요청하신 "손으로 계산해서 화면 값과 일치하는지 확인"을 그대로
반영, 눈으로 훑어보는 게 아니라 실제로 더해보라는 뜻을 명확히 했습니다.

---

## 왜 이 방식이 더 안정적인가

- **서술형 지시("이렇게 되면 안 된다")는 확률적으로만 지켜집니다.** 모델은 매번 "항목을
  먼저 떠올리고 → 그게 우연히 양수로 나오길 바라는" 자연스러운 순서로 흐르기 쉬운데,
  그 흐름 자체를 막지 않고 결과 조건만 걸어두면 이번처럼 절반은 통과, 절반은 실패하는
  식으로 갈립니다.
- **번호 붙은 절차형 지시("먼저 1, 그다음 2, ...")는 실행 순서 자체를 강제**합니다 —
  "목표값을 먼저 정하라"는 게 1번으로 못 박혀 있으면, 모델이 항목을 먼저 나열하고
  마는 습관적 경로를 타기가 훨씬 어려워집니다.
- **수치 제약(차감 ≤ 적립의 절반)은 "자연스러운 양수 범위"라는 모호한 표현보다 훨씬
  강한 가드레일**입니다 — 목표값을 잘못 잡거나 절차를 일부만 따르더라도, 이 제약 하나가
  "차감이 적립을 통째로 집어삼키는" 이번 실패 패턴 자체를 구조적으로 막습니다.
- **검산(4단계)은 마지막 안전망**입니다 — 앞의 세 단계를 다 지켜도 실수로 숫자가 어긋날
  수 있는데, "다 쓴 다음 실제로 더해서 확인하라"는 게 명시돼 있으면 그 실수를 스스로
  잡을 기회가 한 번 더 생깁니다. 자가 점검 항목에도 같은 검산을 다시 요구해서, 총
  두 번(작성 직후 + 완성 선언 직전) 확인하게 했습니다.

---

## 재실측 방법

같은 프롬프트("동네 카페 포인트 적립 앱 만들어줘" 등 적립/차감이 섞이는 도메인)로
**3-5번 반복 생성**해보시고, 매번 아래를 확인해주세요:

1. 대표 지표(잔액/포인트 등)가 **매번** 양수로 나오는가 — 이번 문제는 확률적으로만
   실패했으므로(1차 정상, 2차 실패), 한 번 통과했다고 안심하지 말고 **여러 번 반복**해서
   확인하는 게 중요합니다.
2. 화면에 보이는 개별 항목들(적립 내역·차감 내역)을 실제로 손으로 더해서, 화면에 표시된
   대표 지표와 정확히 일치하는지 확인.
3. 만약 이번에도 실패가 나오면, 그때의 정확한 항목 구성(적립 몇 건 얼마씩, 차감 몇 건
   얼마씩)을 알려주시면 — 이번 규칙의 어느 단계가 안 지켜졌는지(목표값을 안 정했는지,
   차감이 절반을 넘었는지, 검산을 안 했는지) 바로 짚을 수 있습니다.

---

## 검증 내역
- `new-prompt.spec.ts` 10/10 통과(캐시 경계 프리픽스 동일성 포함).
- `vitest run` 전체: 469/470 통과(유일한 실패는 이 작업 환경의 PATH에 `pnpm`이 없어서
  나는 기존 문제, 무관 확인).
- `tsc --noEmit`: 에러 0건. `eslint`: 에러 0건(무관한 기존 warning 1건).
- `npm run build`(client+server): 성공.
- 순증: 문자 수 기준 지운 글자 약 480자, 새로 넣은 글자 약 940자 → **순증 약 460자,
  대략 100~120 토큰 추정**(정확한 토크나이저 없음, 4자≈1토큰 어림). 기존 문장을
  절차형으로 교체한 것이라 완전히 새로운 섹션은 추가하지 않았습니다.

이번에도 실제 브라우저/생성 환경이 없어 직접 재현·검증은 못 했습니다 — 위 재실측
방법대로 확인 부탁드립니다.
