# 야간 자율 루프 3차 리포트 — 기능 격차 해소 + 품질 플라이휠

브랜치: `overnight3-20260824` (버그픽스 반영된 `overnight2-20260824` HEAD에서 분기)
시작: 2026-08-24

## 작업 0: 준비

- [상태: 완료]
- `71ad6b2`(어제 버그 2 수정)에서 분기 확인 — `git log --oneline -5`로 두 버그픽스 커밋(`71ad6b2`, `7311cc1`)이 로그 최상단에 있는 것 확인
- `.gitignore`에 `!/OVERNIGHT-REPORT-3.md` 예외 추가
- **자체 검증**: `grep -c "isContainerVisible" Terminal.tsx` → 3건, `grep -c "showLabel={isLanding}" ChatBox.tsx` → 2건. 둘 다 브랜치에 정상 포함됨 확인
- dev 서버 확인: 200 OK

---

## PART A

### A1: 브라우저 자동번역 방어

- [상태: 완료] 커밋 `972c0e1`
- **진짜 원인 발견**: `app/entry.server.tsx`의 SSR HTML 셸 템플릿 리터럴이 `<html lang="en">`로 박혀 있었음 — 100% 한국어 제품인데 지금까지 쭉 `en`으로 서빙되고 있었다. `root.tsx`(React Head)만 봐서는 안 보이는, entry.server.tsx의 raw 문자열이라 이번에 처음 발견. `lang="ko"`로 수정.
  - 클라이언트에서 `document.documentElement.lang`을 건드리는 코드가 있는지 전수 grep — 없음 확인 (하이드레이션 불일치 위험 없음). `BaseChat.tsx`의 `recognition.lang = 'ko-KR'`은 Web Speech API용이라 무관.
- 플랜명("빛"/"장점" 오역, 어제 버그 3)의 실제 소스는 여전히 코드에 없음 — `pricing.tsx`는 수정 불가 대상이라, 근본 원인을 건드리지 않고 대응할 수 있는 유일한 방법으로 `root.tsx`에 `<meta name="google" content="notranslate">`(페이지 전체 차단)를 추가. 판단 근거: 이 제품은 애초에 한국어 프롬프트 입력이 필수라 비한국어 사용자가 번역해서 쓸 시나리오 자체가 없음 — 과함이 아니라 적절한 트레이드오프로 판단.
  - 구글 외 번역기 대비로 `Logo.tsx` 워드마크 span에 `translate="no"` 추가 (브랜드명 단일 최다 렌더 지점).
  - 플랜명이 `pricing.tsx` 외에 렌더되는 다른 지점이 있는지 전수 스윕 (`무료`/`라이트`/`프로`/`맥스` 전체 grep) — 전부 무관한 문맥(무료체험 안내 문구, "프로필" 등 다른 단어)이었고 실제 플랜명 배지 렌더는 pricing.tsx 하나뿐임을 확인. 즉 이 메타 태그가 유일하고 충분한 대응.
- **검증**: typecheck/lint/build 클린. 컴파일된 서버 번들(`build/server/assets/server-build-*.js`)을 직접 grep해서 `lang="ko"`와 `notranslate` meta 둘 다 실제로 번들에 들어갔음을 확인 (소스 레벨이 아니라 컴파일 산출물 레벨로 검증).
- **아침 확인 필요**: 브라우저에서 우클릭 "번역" 메뉴가 비활성화되는지, Chrome 자동번역 배너가 더 이상 안 뜨는지 실제 확인 필요 (SSR/클릭 이벤트라 서버에서 curl로는 검증 불가한 항목).

---
