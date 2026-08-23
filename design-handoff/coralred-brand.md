# coralred 브랜드 스펙

Claude(또는 Claude Code)에 이 문서를 붙여넣으면 동일한 느낌으로 작업할 수 있습니다.

## 팔레트
- 코랄 (배경/주색): #FF5330
- 크림 (블록/텍스트): #FAF7F0
- 피치 (보조 블록): #FFB5A3
- 피치 위 잉크: #8F2410
- 연한 본문 (코랄 위): #FFD9CC
- 다크 배경: #17100E

## 로고
512×512 그리드 위 6개 라운드 사각형이 'C'를 이룸 (상하 대칭):
- 크림 104×104, r30: (153,63) (63,153) (63,255) (153,345)
- 피치 84×84, r26: (289,84) (289,344)

## 타이포
- IBM Plex Sans KR (400/500/700), 헤드라인 letter-spacing -0.03em

## 모션
- 플로팅: translateY -6→6px, 3.6~4.4s ease-in-out alternate, 블록별 지연 0~1.5s
- 호버: scale(1.1) translateY(-6px), 그림자 0 20px 40px rgba(23,16,14,.25), cubic-bezier(.34,1.56,.64,1)

## 톤
미니멀·플랫. 그라디언트·이모지 금지. 넉넉한 여백, 큰 라운드(블록 비율 약 29%).

## 파일
- coralred-icon.svg / coralred-icon-dark.svg / coralred-symbol.svg
- coralred-hero.html (순수 HTML/CSS) / CoralredHero.jsx (React)
