import { cubicBezier } from 'framer-motion';

export const cubicEasingFn = cubicBezier(0.4, 0, 0.2, 1);

/*
 * 채팅 홈·생성 전환 통합 수정 — 첫 렌더 시 데스크톱 2단 전환(대화 칼럼 축소 + 미리보기 진입)
 * 전용 이징. cubicEasingFn은 다른 UI(워크벤치 열기/닫기 등 이번 라운드 밖 동작)에서 계속 쓰이므로
 * 그 의미를 안 건드리기 위해 별도 상수로 둔다.
 */
export const panelTransitionEasing = cubicBezier(0.32, 0.72, 0, 1);
export const panelTransitionDurationSec = 0.36;
