import ignore from 'ignore';
import type { ProviderInfo } from '~/types/model';
import type { Template } from '~/types/template';
import { STARTER_TEMPLATES } from './constants';
import { designSchemeToHue } from './paletteToHue';
import {
  coralredUiCss,
  CORALRED_HEAD_INJECTION,
  CORALRED_BOLT_PROMPT,
  CORALRED_INDEX_CSS,
  CORALRED_APP_TSX,
} from './coralredKit';

const starterTemplateSelectionPrompt = (templates: Template[]) => `
You are an experienced developer who helps people choose the best starter template for their projects.
IMPORTANT: Vite is preferred
IMPORTANT: Only choose shadcn templates if the user explicitly asks for shadcn.
CRITICAL: Always choose a web template. Korean words like '앱', '어플', '애플리케이션' mean a web application the user opens in a browser — they do NOT mean a native mobile app. '커뮤니티 앱', '예약 앱', '쇼핑몰 앱' are all web apps. Prefer Vite-based web templates.

Available templates:
<template>
  <name>blank</name>
  <description>Empty starter for simple scripts and trivial tasks that don't require a full template setup</description>
  <tags>basic, script</tags>
</template>
${templates
  .map(
    (template) => `
<template>
  <name>${template.name}</name>
  <description>${template.description}</description>
  ${template.tags ? `<tags>${template.tags.join(', ')}</tags>` : ''}
</template>
`,
  )
  .join('\n')}

Response Format:
<selection>
  <templateName>{selected template name}</templateName>
  <title>{a proper title for the project}</title>
</selection>

Examples:

<example>
User: I need to build a todo app
Response:
<selection>
  <templateName>react-basic-starter</templateName>
  <title>Simple React todo application</title>
</selection>
</example>

<example>
User: Write a script to generate numbers from 1 to 100
Response:
<selection>
  <templateName>blank</templateName>
  <title>script to generate numbers from 1 to 100</title>
</selection>
</example>

Instructions:
1. For trivial tasks and simple scripts, always recommend the blank template
2. For more complex projects, recommend templates from the provided list
3. Follow the exact XML format
4. Consider both technical requirements and tags
5. If no perfect match exists, recommend the closest option

Important: Provide only the selection tags in your response, no additional text.
MOST IMPORTANT: YOU DONT HAVE TIME TO THINK JUST START RESPONDING BASED ON HUNCH 
`;

const templates: Template[] = STARTER_TEMPLATES.filter((t) => !t.name.includes('shadcn'));

const parseSelectedTemplate = (llmOutput: string): { template: string; title: string } | null => {
  try {
    // Extract content between <templateName> tags
    const templateNameMatch = llmOutput.match(/<templateName>(.*?)<\/templateName>/);
    const titleMatch = llmOutput.match(/<title>(.*?)<\/title>/);

    if (!templateNameMatch) {
      return null;
    }

    return { template: templateNameMatch[1].trim(), title: titleMatch?.[1].trim() || 'Untitled Project' };
  } catch (error) {
    console.error('Error parsing template selection:', error);
    return null;
  }
};

export const selectStarterTemplate = async (options: { message: string; model: string; provider: ProviderInfo }) => {
  const { message, model, provider } = options;
  const requestBody = {
    message,
    model,
    provider,
    system: starterTemplateSelectionPrompt(templates),
  };

  try {
    const response = await fetch('/api/llmcall', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    const respJson: { text: string } = await response.json();
    console.log(respJson);

    const { text } = respJson;
    const selectedTemplate = parseSelectedTemplate(text);

    if (selectedTemplate) {
      return selectedTemplate;
    }
  } catch (error) {
    /*
     * A network failure or a non-JSON response (e.g. an HTML error page) here must not
     * propagate: the caller (Chat.client.tsx#generateNewApp) has already deducted the
     * user's free-generation credit and doesn't wrap this call, so an unhandled rejection
     * would strand the chat in a permanent loading state. Degrade to blank instead.
     */
    console.error('Error selecting starter template, falling back to blank template:', error);
  }

  console.log('No template selected, using blank template');

  return {
    template: 'blank',
    title: '',
  };
};

const getGitHubRepoContent = async (
  repoName: string,
  hue: number,
): Promise<{ name: string; path: string; content: string }[]> => {
  try {
    // Instead of directly fetching from GitHub, use our own API endpoint as a proxy
    const response = await fetch(`/api/github-template?repo=${encodeURIComponent(repoName)}&hue=${hue}`);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { code?: string; error?: string } | null;
      const code = body?.code;
      const message =
        code === 'not_found'
          ? `Template not found: ${repoName}`
          : code === 'rate_limited'
            ? `rate limit exceeded fetching template: ${repoName}`
            : (body?.error ?? `HTTP error! status: ${response.status}`);
      throw new Error(message);
    }

    // Our API will return the files in the format we need
    const files = (await response.json()) as any;

    return files;
  } catch (error) {
    console.error('Error fetching release contents:', error);
    throw error;
  }
};

export async function getTemplates(templateName: string, title?: string, hue: number = designSchemeToHue()) {
  const template = STARTER_TEMPLATES.find((t) => t.name == templateName);

  if (!template) {
    return null;
  }

  const githubRepo = template.githubRepo;
  const files = await getGitHubRepoContent(githubRepo, hue);

  let filteredFiles = files;

  /*
   * ignoring common unwanted files
   * exclude    .git
   */
  filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.git') == false);

  /*
   * exclude    lock files
   * WE NOW INCLUDE LOCK FILES FOR IMPROVED INSTALL TIMES
   */
  {
    /*
     *const comminLockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
     *filteredFiles = filteredFiles.filter((x) => comminLockFiles.includes(x.name) == false);
     */
  }

  // exclude    .bolt
  filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.bolt') == false);

  // check for ignore file in .bolt folder
  const templateIgnoreFile = files.find((x) => x.path.startsWith('.bolt') && x.name == 'ignore');

  const filesToImport = {
    files: filteredFiles,
    ignoreFile: [] as typeof filteredFiles,
  };

  if (templateIgnoreFile) {
    // redacting files specified in ignore file
    const ignorepatterns = templateIgnoreFile.content.split('\n').map((x) => x.trim());
    const ig = ignore().add(ignorepatterns);

    // filteredFiles = filteredFiles.filter(x => !ig.ignores(x.path))
    const ignoredFiles = filteredFiles.filter((x) => ig.ignores(x.path));

    filesToImport.files = filteredFiles;
    filesToImport.ignoreFile = ignoredFiles;
  }

  const assistantMessage = `
코랄레드가 ${template.name} 템플릿으로 필요한 파일을 준비해서 프로젝트를 초기화하고 있어요.
<boltArtifact id="imported-files" title="${title || 'Create initial files'}" type="bundled">
${filesToImport.files
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${file.content}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>
`;
  let userMessage = ``;
  const templatePromptFile = files.filter((x) => x.path.startsWith('.bolt')).find((x) => x.name == 'prompt');

  if (templatePromptFile) {
    userMessage = `
TEMPLATE INSTRUCTIONS:
${templatePromptFile.content}

---
`;
  }

  if (filesToImport.ignoreFile.length > 0) {
    userMessage =
      userMessage +
      `
STRICT FILE ACCESS RULES - READ CAREFULLY:

The following files are READ-ONLY and must never be modified:
${filesToImport.ignoreFile.map((file) => `- ${file.path}`).join('\n')}

Permitted actions:
✓ Import these files as dependencies
✓ Read from these files
✓ Reference these files

Strictly forbidden actions:
❌ Modify any content within these files
❌ Delete these files
❌ Rename these files
❌ Move these files
❌ Create new versions of these files
❌ Suggest changes to these files

Any attempt to modify these protected files will result in immediate termination of the operation.

If you need to make changes to functionality, create new files instead of modifying the protected ones listed above.
---
`;
  }

  userMessage += `
---
template import is done, and you can now use the imported files,
edit only the files that need to be changed, and you can create new files as needed.
NO NOT EDIT/WRITE ANY FILES THAT ALREADY EXIST IN THE PROJECT AND DOES NOT NEED TO BE MODIFIED
---
Now that the Template is imported please continue with my original request

IMPORTANT: Dont Forget to install the dependencies before running the app by using \`npm install && npm run dev\`
`;

  return {
    assistantMessage,
    userMessage,
  };
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
 * wired in from the start. Used via the same synthetic-history mechanism as getTemplates() —
 * a fake assistant turn that "imports" these files, followed by a hidden user turn asking the
 * LLM to continue — for both cases that currently fall through with zero files: the LLM
 * choosing 'blank', and a GitHub template fetch failing. Doesn't touch GitHub at all, so it
 * can't fail the way a template fetch can.
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
<boltArtifact id="coralred-baseline" title="Create initial files" type="bundled">
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
