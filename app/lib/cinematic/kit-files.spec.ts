import { describe, expect, it } from 'vitest';
import { getBaselineTemplate } from '~/utils/selectStarterTemplate';
import { CINEMATIC_KIT_FILES, CINEMATIC_KIT_PROMPT } from './kit-files';

function filesFromTemplate(cinematic: boolean): Record<string, string> {
  const { assistantMessage } = getBaselineTemplate(33, { cinematic });
  const out: Record<string, string> = {};

  for (const match of assistantMessage.matchAll(
    /<boltAction type="file" filePath="([^"]+)">\n([\s\S]*?)\n<\/boltAction>/g,
  )) {
    out[match[1]] = match[2];
  }

  return out;
}

describe('cinematic kit files', () => {
  /*
   * vitest는 기본값 css:false라 `?raw`로 읽은 CSS가 빈 문자열로 온다(Vite/Remix 프로덕션 번들에서는
   * 정상 — coralred-ui.css가 같은 방식으로 이미 쓰인다). 그래서 TS/TSX만 내용으로 검사하고, CSS는
   * 런타임 가드(seedKit.ts)가 빈 파일이면 트랙을 되돌리는 것으로 막는다.
   */
  it('carries every kit source as real text (not an empty ?raw resolve)', () => {
    const entries = Object.entries(CINEMATIC_KIT_FILES);
    expect(entries).toHaveLength(21);

    for (const [path, content] of entries) {
      expect(typeof content, path).toBe('string');
      expect(content, path).not.toContain('[object Object]');

      if (!path.endsWith('.css')) {
        expect(content.length, path).toBeGreaterThan(200);
      }
    }
  });

  it('ships the barrel the prompt tells the model to import', () => {
    expect(CINEMATIC_KIT_FILES['src/kit/index.ts']).toContain('Showcase3D');
    expect(Object.keys(CINEMATIC_KIT_FILES)).toContain('src/kit/tokens.css');
  });

  it('only names components the barrel actually exports', () => {
    const barrel = CINEMATIC_KIT_FILES['src/kit/index.ts'];
    const imported = CINEMATIC_KIT_PROMPT.match(/import \{([^}]+)\} from '\.\/kit'/)?.[1] ?? '';
    const names = imported
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    expect(names.length).toBeGreaterThan(5);

    for (const name of names) {
      expect(barrel, name).toContain(name);
    }
  });
});

describe('baseline template — cinematic track', () => {
  it('adds kit dependencies, fonts, token import and prompt', () => {
    const files = filesFromTemplate(true);
    const pkg = JSON.parse(files['package.json']);

    expect(pkg.dependencies.three).toBeTruthy();
    expect(pkg.dependencies.gsap).toBeTruthy();
    expect(pkg.dependencies.lenis).toBeTruthy();
    expect(pkg.dependencies['@react-three/fiber']).toBeTruthy();
    expect(pkg.dependencies.react).toBeTruthy();
    expect(pkg.devDependencies['@types/three']).toBeTruthy();

    expect(files['src/main.tsx']).toContain("import './kit/tokens.css';");
    expect(files['index.html']).toContain('Familjen+Grotesk');
    expect(files['.bolt/prompt']).toContain('src/kit/');
  });

  it('leaves the default track untouched — no three, no kit import', () => {
    const files = filesFromTemplate(false);
    const pkg = JSON.parse(files['package.json']);

    expect(pkg.dependencies.three).toBeUndefined();
    expect(files['src/main.tsx']).not.toContain('kit/tokens.css');
    expect(files['index.html']).not.toContain('Familjen+Grotesk');
    expect(files['.bolt/prompt']).not.toContain('src/kit/');
  });

  it('never puts kit source into the seeded artifact (context cost)', () => {
    const { assistantMessage } = getBaselineTemplate(33, { cinematic: true });

    expect(assistantMessage).not.toContain('export function HeroScene');
    expect(assistantMessage.length).toBeLessThan(60_000);
  });
});
