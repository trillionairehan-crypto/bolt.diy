import { atom } from 'nanostores';

/*
 * 미리보기 dev 서버 사망 감지 — 2026-09-18 프로덕션 실측: 한 탭에서 생성을 ~7회 돌리자 터미널에
 * `[vite] Pre-transform error: The service was stopped (x17)`가 찍히고 프리뷰는 "미리볼 화면이 없어요",
 * 액션은 영영 'running'(post-stream stall의 세 번째 경로). esbuild 서비스 프로세스가 컨테이너 안에서
 * 죽은 것이라 LLM 자동 수정으로는 못 고친다 — 코드 문제가 아니다. 셸 출력에서 잡아 dev 서버를
 * 다시 띄우고, 그래도 반복되면 사용자에게 새 탭을 안내한다.
 */
/*
 * `Pre-transform error`만으로는 안 된다 — 생성 중 잘못된 import(CustomCursor 등)에도 Vite가 같은 접두사를 찍는다.
 * 2026-09-20 실생성: 그걸 사망으로 오인해 멀쩡한 dev 서버를 재시작 → 프리뷰 백지 + stall(첫 런부터). esbuild
 * 서비스 사망 문구 자체만 본다.
 */
export const DEV_SERVER_CRASH_REGEX = /The service was stopped/;

/** 같은 사망을 x17처럼 여러 줄로 찍으므로 이 창 안의 반복은 한 번으로 센다. */
const CRASH_DEDUPE_WINDOW_MS = 10_000;

export interface DevServerCrash {
  /** 세션 안에서 몇 번째 감지인지 — 재시작 예산 판단용. */
  count: number;
  lastAt: number;

  /** 감지된 줄(ANSI 제거) — 알림·Sentry용. */
  sample: string;
}

export const devServerCrashAtom = atom<DevServerCrash | null>(null);

const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

/**
 * 셸 출력 청크를 본다. 사망 문구가 있고 dedupe 창 밖이면 atom을 갱신하고 true를 돌려준다.
 * `now`는 테스트용 주입.
 */
export function noteDevServerOutput(chunk: string, now: number = Date.now()): boolean {
  if (!DEV_SERVER_CRASH_REGEX.test(chunk)) {
    return false;
  }

  const previous = devServerCrashAtom.get();

  if (previous && now - previous.lastAt < CRASH_DEDUPE_WINDOW_MS) {
    return false;
  }

  const line =
    chunk
      .replace(ANSI_REGEX, '')
      .split(/\r?\n/)
      .find((l) => DEV_SERVER_CRASH_REGEX.test(l))
      ?.trim() ?? 'The service was stopped';

  devServerCrashAtom.set({ count: (previous?.count ?? 0) + 1, lastAt: now, sample: line.slice(0, 200) });

  return true;
}

/** 테스트·새 세션용. */
export function resetDevServerHealth(): void {
  devServerCrashAtom.set(null);
}
