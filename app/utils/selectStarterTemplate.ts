import {
  CINEMATIC_BOLT_PROMPT_ADDITION,
  CINEMATIC_FONT_LINKS,
  CINEMATIC_KIT_DEPENDENCIES,
  CINEMATIC_KIT_DEV_DEPENDENCIES,
} from '~/lib/cinematic/kit-files';
import {
  CORALRED_APP_TSX,
  CORALRED_BOLT_PROMPT,
  CORALRED_HEAD_INJECTION,
  CORALRED_INDEX_CSS,
  coralredUiCss,
} from './coralredKit';

/**
 * 시네마틱 트랙은 킷이 쓰는 three·@react-three/fiber·gsap·lenis가 더 필요하다. 기본 트랙에 넣지 않는 이유는
 * WebContainer에서 three 설치가 실측 약 60초 걸려(0단계 rubric.md) 모든 생성이 그만큼 느려지기 때문이다.
 */
function buildBaselinePackageJson(cinematic: boolean): string {
  const pkg = JSON.parse(BASELINE_PACKAGE_JSON) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  if (!cinematic) {
    return BASELINE_PACKAGE_JSON;
  }

  pkg.dependencies = sortedRecord({ ...pkg.dependencies, ...CINEMATIC_KIT_DEPENDENCIES });
  pkg.devDependencies = sortedRecord({ ...pkg.devDependencies, ...CINEMATIC_KIT_DEV_DEPENDENCIES });

  return `${JSON.stringify(pkg, null, 2)}
`;
}

function sortedRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

const BASELINE_PACKAGE_JSON = `{
  "name": "coralred-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^0.485.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.2"
  }
}
`;

const BASELINE_VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;

function buildBaselineMainTsx(cinematic: boolean): string {
  // 킷 토큰(ck- 클래스, --ck-* 변수)은 앱 진입점에서 한 번 읽어야 한다.
  return cinematic
    ? BASELINE_MAIN_TSX.replace("import './index.css';", "import './kit/tokens.css';\nimport './index.css';")
    : BASELINE_MAIN_TSX;
}

const BASELINE_MAIN_TSX = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;

function buildBaselineIndexHtml(hue: number, cinematic = false): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Coralred App</title>
${CORALRED_HEAD_INJECTION}${cinematic ? CINEMATIC_FONT_LINKS : ''}</head>
  <body style="--hue: ${hue};">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

/**
 * The Coralred baseline: a minimal, working Vite + React scaffold with the design kit already
 * wired in from the start. Seeded via a synthetic history — a fake assistant turn that "imports"
 * these files, followed by a hidden user turn asking the LLM to continue.
 *
 * This is now the ONLY way a new app gets scaffolded (2026-09-03, 출시 블로커 fix). It used to be
 * one fallback among several — an LLM would first pick from a dozen-plus framework starter
 * templates (Astro, Vue, Angular, Next.js, ...) fetched live from GitHub via
 * `app/routes/api.github-template.ts`, and this baseline only ran if that LLM picked 'blank' or
 * the fetch failed. That whole selection layer is gone: it let the picker choose a framework the
 * generation pipeline (App.tsx-based React, coralredKit, every skeleton prompt in
 * new-prompt.ts) doesn't actually support — confirmed broken for Astro specifically (the LLM
 * dutifully wrote into App.tsx, but the live preview only ever serves src/pages/index.astro,
 * which nothing wires App.tsx into — the generated app was dead on arrival). Since coralred only
 * ever needs one shape, this local, GitHub-independent baseline is the only path: no network
 * dependency, no LLM selection call, no risk of picking something the pipeline can't render.
 */
export function getBaselineTemplate(hue: number, options: { cinematic?: boolean } = {}) {
  /*
   * 시네마틱 트랙(골격 7 소개·홍보형)은 킷 의존성·서체·토큰 import가 더 붙는다. 킷 소스 자체는 여기 없다 —
   * 86KB라 아티팩트에 넣으면 첫 생성 컨텍스트가 그만큼 커진다. seedCinematicKit()이 WebContainer에 직접 쓴다.
   */
  const cinematic = options.cinematic === true;
  const files: { path: string; content: string }[] = [
    { path: 'package.json', content: buildBaselinePackageJson(cinematic) },
    { path: 'vite.config.ts', content: BASELINE_VITE_CONFIG },
    { path: 'index.html', content: buildBaselineIndexHtml(hue, cinematic) },
    { path: 'src/main.tsx', content: buildBaselineMainTsx(cinematic) },
    { path: 'src/App.tsx', content: CORALRED_APP_TSX },
    { path: 'src/index.css', content: CORALRED_INDEX_CSS },
    { path: 'public/coralred-ui.css', content: coralredUiCss },
    {
      path: '.bolt/prompt',
      content: cinematic ? `${CORALRED_BOLT_PROMPT}${CINEMATIC_BOLT_PROMPT_ADDITION}` : CORALRED_BOLT_PROMPT,
    },
  ];

  /*
   * 시네마틱 트랙은 설치·구동을 아티팩트가 직접 한다. 실측(2026-09-12 첫 트랙 생성): 모델이
   * "npm install과 개발 서버는 이미 실행 중이라 별도로 다시 돌릴 필요는 없어요"라고 쓰고 설치를
   * 건너뛰어, 새로 추가된 three·gsap·lenis가 없는 채로 미리보기가 아예 안 떴다. 기본 트랙은 모델이
   * 직접 실행하는 기존 동작을 유지한다(잘 돌고 있음).
   */
  const bootActions = cinematic
    ? `
<boltAction type="shell">npm install</boltAction>
<boltAction type="start">npm run dev</boltAction>`
    : '';

  const assistantMessage = `
코랄레드가 기본 브랜드 킷으로 프로젝트를 초기화하고 있어요.
<boltArtifact id="coralred-baseline" title="새 앱" type="bundled">
${files
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${file.content}
</boltAction>`,
  )
  .join('\n')}${bootActions}
</boltArtifact>
`;

  const userMessage = `
---
baseline setup is done, and you can now use these files,
edit only the files that need to be changed, and you can create new files as needed.
NO NOT EDIT/WRITE ANY FILES THAT ALREADY EXIST IN THE PROJECT AND DOES NOT NEED TO BE MODIFIED
---
Now that the baseline is set up please continue with my original request

IMPORTANT: Dont Forget to install the dependencies before running the app by using \`npm install && npm run dev\`
`;

  return {
    assistantMessage,
    userMessage,
  };
}
