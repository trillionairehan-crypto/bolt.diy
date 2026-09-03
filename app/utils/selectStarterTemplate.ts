import {
  CORALRED_APP_TSX,
  CORALRED_BOLT_PROMPT,
  CORALRED_HEAD_INJECTION,
  CORALRED_INDEX_CSS,
  coralredUiCss,
} from './coralredKit';

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

function buildBaselineIndexHtml(hue: number): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Coralred App</title>
${CORALRED_HEAD_INJECTION}</head>
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
export function getBaselineTemplate(hue: number) {
  const files: { path: string; content: string }[] = [
    { path: 'package.json', content: BASELINE_PACKAGE_JSON },
    { path: 'vite.config.ts', content: BASELINE_VITE_CONFIG },
    { path: 'index.html', content: buildBaselineIndexHtml(hue) },
    { path: 'src/main.tsx', content: BASELINE_MAIN_TSX },
    { path: 'src/App.tsx', content: CORALRED_APP_TSX },
    { path: 'src/index.css', content: CORALRED_INDEX_CSS },
    { path: 'public/coralred-ui.css', content: coralredUiCss },
    { path: '.bolt/prompt', content: CORALRED_BOLT_PROMPT },
  ];

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
  .join('\n')}
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
