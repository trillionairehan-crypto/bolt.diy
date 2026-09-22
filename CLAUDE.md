# CLAUDE.md

작업 시작 전 `HANDOFF.md`(상태·함정·다음 할 일) → `ARCHITECTURE.md`(폴더별 담당·호출자·변경 영향) 순으로 읽는다. 결함·정리 목록은 `docs/AUDIT-2026-09-22.md`. 사용법·환경 변수는 `README.md`.

- 작업 브랜치 `feat/media-gen`(워크트리 `bolt.diy-media-gen`), `main`은 fast-forward로 따라감.
- 커밋 전: `npx tsc --noEmit -p .`, `npx eslint <files>`, 관련 `npx vitest run`. 파일은 LF.
- 킷(`kits/cinematic/src`) 변경은 `tests/benchmark/cinematic` 하네스로 결정적 검증. 프롬프트 변경은 실생성 1런.
- 결함을 고치면 `tests/benchmark/cinematic/rubric.md`에 날짜 절로 실측·원인·수정을 남긴다.
- LLM에게 가는 문구에 `<jobId>` 같은 자리표시자를 넣지 않는다(모델이 그대로 복사한다).
- 한국어 UI 문구는 `design-handoff/coralred-voice.md`.
