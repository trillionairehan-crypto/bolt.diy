import { workbenchStore } from '~/lib/stores/workbench';
import { WORK_DIR } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';
import { CINEMATIC_KIT_FILES } from './kit-files';

const logger = createScopedLogger('cinematicKit');

/**
 * 시네마틱 킷 소스를 생성 프로젝트에 직접 쓴다(src/kit/). 아티팩트(boltAction)로 쓰지 않는 이유는
 * 그러면 86KB짜리 소스가 assistant 메시지로 들어가 첫 생성 컨텍스트에 그대로 얹히기 때문이다.
 * 모델에게는 kit-files.ts의 짧은 API 요약만 간다.
 *
 * baseline 아티팩트(package.json·main.tsx·index.html)가 실행되기 전에 끝나야 vite가 첫 부팅에서
 * import를 바로 찾는다 — 호출 쪽에서 await 한다. WebContainer 부팅을 기다리므로 최초 1회는 느릴 수 있다.
 */
export async function seedCinematicKit(): Promise<boolean> {
  try {
    const entries = Object.entries(CINEMATIC_KIT_FILES);

    /*
     * `?raw` 임포트는 이 저장소에서 이미 한 번 조용히 빈 값으로 떨어진 적이 있다(벤치마크 harness의
     * esbuild가 킷 CSS를 {}로 resolve → "[object Object]", tests/benchmark/lib.ts 주석). 빈 파일을 쓰면
     * 생성물이 스타일 없이 조용히 깨지므로, 하나라도 비어 있으면 시드를 포기하고 기본 트랙으로 되돌린다.
     */
    const empty = entries.filter(([, content]) => typeof content !== 'string' || content.trim().length === 0);

    if (empty.length > 0) {
      logger.error(
        'cinematic kit sources came back empty',
        empty.map(([path]) => path),
      );

      return false;
    }

    for (const [relativePath, content] of entries) {
      await workbenchStore.createFileQuiet(`${WORK_DIR}/${relativePath}`, content);
    }

    logger.info(`seeded ${entries.length} cinematic kit files`);

    return true;
  } catch (error) {
    // 킷이 없으면 모델이 킷 컴포넌트를 import 하는 순간 깨진다 — 호출 쪽이 트랙을 되돌릴 수 있게 false를 준다.
    logger.error('failed to seed cinematic kit', error);

    return false;
  }
}
