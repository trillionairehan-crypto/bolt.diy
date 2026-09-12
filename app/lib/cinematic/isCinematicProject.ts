/*
 * 이 프로젝트가 시네마틱 트랙인지 서버에서 판정한다.
 *
 * 클라이언트 상태로 내려보내지 않고 파일맵으로 보는 이유: 트랙 여부는 새로고침·재접속·이어하기 뒤에도
 * 유지돼야 하는데, 그때 살아남는 건 프로젝트 파일뿐이다. seedCinematicKit()이 쓴 src/kit/이 그 증거다.
 *
 * 채팅 요청 body의 files가 그대로 서버까지 오므로(api.chat.ts → stream-text.ts) 별도 배선이 필요 없다.
 */

/** 킷이 시드됐다는 증거 파일. seedKit.ts가 쓰는 경로 중 하나여야 한다. */
const KIT_MARKER = 'src/kit/tokens.css';

/** @param files 워크벤치 파일맵. 키는 `/home/project/...` 형태의 절대 경로다. */
export function isCinematicProject(files?: Record<string, unknown>): boolean {
  if (!files) {
    return false;
  }

  return Object.keys(files).some((path) => path.endsWith(KIT_MARKER));
}
