import { json } from '@remix-run/cloudflare';
import JSZip from 'jszip';
import { designSchemeToHue } from '~/utils/paletteToHue';
import {
  coralredUiCss,
  CORALRED_HEAD_MARKER,
  CORALRED_HEAD_INJECTION,
  CORALRED_BOLT_PROMPT,
  CORALRED_INDEX_CSS,
  CORALRED_APP_TSX,
} from '~/utils/coralredKit';

/**
 * `not_found`: the repo genuinely doesn't exist (permanent, no retry) — surfaces as "template
 * not found". `rate_limited`/`transient`: GitHub API hiccup, network error, or 5xx — these are
 * retried, and if still failing after retries, surfaced distinctly so the client doesn't
 * silently treat "GitHub had a bad second" the same as "this template was deleted".
 */
type GithubTemplateErrorCode = 'not_found' | 'rate_limited' | 'transient';

class GithubTemplateError extends Error {
  code: GithubTemplateErrorCode;

  constructor(code: GithubTemplateErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches with retry for transient failures only. 404s are permanent (repo doesn't exist) and
 * returned immediately without retrying. 429/5xx and network errors are retried up to
 * `maxRetries` times with exponential backoff, since these were observed to happen transiently
 * against a repo that demonstrably exists.
 */
async function fetchGithubWithRetry(url: string, init: RequestInit, maxRetries = 2, baseDelayMs = 300) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, init);

      if (response.ok || response.status === 404) {
        return response;
      }

      const isRateLimited = response.status === 403 || response.status === 429;
      lastError = new GithubTemplateError(
        isRateLimited ? 'rate_limited' : 'transient',
        `GitHub API ${isRateLimited ? 'rate limit' : 'error'}: ${response.status} ${response.statusText} (${url})`,
      );

      if (attempt < maxRetries) {
        console.warn(
          `[github-template] attempt ${attempt + 1}/${maxRetries + 1} failed for ${url}: ${response.status}, retrying...`,
        );
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }

      return response;
    } catch (networkError) {
      lastError = new GithubTemplateError(
        'transient',
        `Network error fetching ${url}: ${networkError instanceof Error ? networkError.message : String(networkError)}`,
      );

      if (attempt < maxRetries) {
        console.warn(
          `[github-template] attempt ${attempt + 1}/${maxRetries + 1} network error for ${url}, retrying...`,
          networkError,
        );
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
    }
  }

  throw lastError;
}

/** Templates whose whole identity is Tailwind (shadcn/ui is built on it) — never strip Tailwind from these. */
function isShadcnTemplate(repo: string) {
  return repo.toLowerCase().includes('shadcn');
}

/**
 * Removes the template's stock Tailwind wiring and replaces the stub App.tsx with a
 * cr--class-based example, so the project doesn't have dead config or a stub that
 * contradicts the "no Tailwind" instruction in .bolt/prompt. Skipped for shadcn templates,
 * since shadcn/ui components are themselves built on Tailwind.
 */
function stripTailwindWiring(files: { name: string; path: string; content: string }[]) {
  const withoutTailwindConfigs = files.filter(
    (file) => file.path !== 'tailwind.config.js' && file.path !== 'postcss.config.js',
  );

  const packageJson = withoutTailwindConfigs.find((file) => file.path === 'package.json');

  if (packageJson) {
    try {
      const parsed = JSON.parse(packageJson.content);

      for (const dep of ['tailwindcss', 'postcss', 'autoprefixer']) {
        delete parsed.devDependencies?.[dep];
        delete parsed.dependencies?.[dep];
      }

      packageJson.content = JSON.stringify(parsed, null, 2) + '\n';
    } catch {
      // Malformed package.json — leave it as-is rather than risk corrupting it further.
    }
  }

  const indexCss = withoutTailwindConfigs.find((file) => file.path === 'src/index.css');

  if (indexCss) {
    indexCss.content = CORALRED_INDEX_CSS;
  }

  const appTsx = withoutTailwindConfigs.find((file) => file.path === 'src/App.tsx');

  if (appTsx) {
    appTsx.content = CORALRED_APP_TSX;
  }

  return withoutTailwindConfigs;
}

const LUCIDE_REACT_MIN_VERSION: [number, number, number] = [0, 485, 0];

/**
 * Parses a simple "^X.Y.Z" (or bare "X.Y.Z") version string into a comparable tuple. Returns
 * null for anything more complex (range operators other than ^, "latest", a workspace protocol,
 * etc.) — those are left untouched rather than risk misinterpreting them.
 */
function parseSimpleVersion(version: string): [number, number, number] | null {
  const match = /^\^?(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());

  if (!match) {
    return null;
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isOlderThan(version: string, minVersion: [number, number, number]): boolean {
  const parsed = parseSimpleVersion(version);

  if (!parsed) {
    return false;
  }

  for (let i = 0; i < 3; i++) {
    if (parsed[i] !== minVersion[i]) {
      return parsed[i] < minVersion[i];
    }
  }

  return false;
}

/**
 * Some starter templates pin a stale lucide-react version whose older icon names (e.g.
 * AlertTriangle) were later renamed (TriangleAlert) with the old name kept only as an alias
 * from ^0.485.0 onward. The LLM sometimes writes the newer name regardless of what the template
 * pins, which produces a hard "no such export" failure against an old pin — the same problem
 * BASELINE_PACKAGE_JSON in selectStarterTemplate.ts was bumped to fix. Only bumps in place when
 * lucide-react is already a dependency and older than 0.485.0 — never adds it to a template that
 * doesn't use it, and never touches a pin that's already newer.
 */
function bumpLucideReactVersion(files: { name: string; path: string; content: string }[]) {
  const packageJson = files.find((file) => file.path === 'package.json');

  if (!packageJson) {
    return;
  }

  try {
    const parsed = JSON.parse(packageJson.content);
    const current = parsed.dependencies?.['lucide-react'];

    if (typeof current === 'string' && isOlderThan(current, LUCIDE_REACT_MIN_VERSION)) {
      parsed.dependencies['lucide-react'] = '^0.485.0';
      packageJson.content = JSON.stringify(parsed, null, 2) + '\n';
    }
  } catch {
    // Malformed package.json — leave it as-is rather than risk corrupting it further.
  }
}

/**
 * Injects the Coralred design kit into a fetched template:
 * - font links + coralred-ui.css into index.html's <head>
 * - the computed --hue value directly into index.html's <body> (never left for the LLM to guess)
 * - coralred-ui.css itself as a new file
 * - .bolt/prompt replaced with kit-based instructions (added if the template doesn't have one)
 * - the template's stock Tailwind wiring removed and its stub App.tsx replaced
 * - a stale pinned lucide-react version bumped to ^0.485.0, if present (see bumpLucideReactVersion)
 * All of the above (except font links/coralred-ui.css/--hue/the lucide-react bump) are skipped
 * for shadcn templates, since shadcn/ui — and the "don't use Tailwind" instruction — would
 * directly contradict it.
 * Head/body/CSS injection is skipped when the template has no root index.html (e.g. Next.js,
 * Astro, Remix, SvelteKit templates) so nothing is left orphaned.
 */
function injectCoralredDesignKit(files: { name: string; path: string; content: string }[], hue: number, repo: string) {
  const isShadcn = isShadcnTemplate(repo);
  let result = isShadcn ? files : stripTailwindWiring(files);

  /*
   * Applies to every template, shadcn included — the stale-version problem is unrelated to
   * Tailwind, and shadcn templates use lucide-react too (see e.g. vite-shadcn).
   */
  bumpLucideReactVersion(result);

  if (!isShadcn) {
    const boltPrompt = result.find((file) => file.path === '.bolt/prompt');

    if (boltPrompt) {
      boltPrompt.content = CORALRED_BOLT_PROMPT;
    } else {
      result = [...result, { name: 'prompt', path: '.bolt/prompt', content: CORALRED_BOLT_PROMPT }];
    }
  }

  const indexHtml = result.find((file) => file.path === 'index.html');

  if (!indexHtml || indexHtml.content.includes(CORALRED_HEAD_MARKER)) {
    return result;
  }

  indexHtml.content = indexHtml.content
    .replace('</head>', `${CORALRED_HEAD_INJECTION}</head>`)
    .replace(/<body([^>]*)>/, `<body style="--hue: ${hue};"$1>`);

  return [...result, { name: 'coralred-ui.css', path: 'public/coralred-ui.css', content: coralredUiCss }];
}

// Function to detect if we're running in Cloudflare
function isCloudflareEnvironment(context: any): boolean {
  // Check if we're in production AND have Cloudflare Pages specific env vars
  const isProduction = process.env.NODE_ENV === 'production';
  const hasCfPagesVars = !!(
    context?.cloudflare?.env?.CF_PAGES ||
    context?.cloudflare?.env?.CF_PAGES_URL ||
    context?.cloudflare?.env?.CF_PAGES_COMMIT_SHA
  );

  return isProduction && hasCfPagesVars;
}

// Cloudflare-compatible method using GitHub Contents API
async function fetchRepoContentsCloudflare(repo: string, githubToken?: string) {
  const baseUrl = 'https://api.github.com';

  // Get repository info to find default branch
  const repoResponse = await fetchGithubWithRetry(`${baseUrl}/repos/${repo}`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'bolt.diy-app',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (repoResponse.status === 404) {
    throw new GithubTemplateError('not_found', `Repository not found: ${repo}`);
  }

  if (!repoResponse.ok) {
    throw new GithubTemplateError(
      repoResponse.status === 403 || repoResponse.status === 429 ? 'rate_limited' : 'transient',
      `Failed to fetch repository info for ${repo}: ${repoResponse.status} ${repoResponse.statusText}`,
    );
  }

  const repoData = (await repoResponse.json()) as any;
  const defaultBranch = repoData.default_branch;

  // Get the tree recursively
  const treeResponse = await fetchGithubWithRetry(`${baseUrl}/repos/${repo}/git/trees/${defaultBranch}?recursive=1`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'bolt.diy-app',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (treeResponse.status === 404) {
    throw new GithubTemplateError('not_found', `Repository tree not found: ${repo}`);
  }

  if (!treeResponse.ok) {
    throw new GithubTemplateError(
      treeResponse.status === 403 || treeResponse.status === 429 ? 'rate_limited' : 'transient',
      `Failed to fetch repository tree for ${repo}: ${treeResponse.status} ${treeResponse.statusText}`,
    );
  }

  const treeData = (await treeResponse.json()) as any;

  // Filter for files only (not directories) and limit size
  const files = treeData.tree.filter((item: any) => {
    if (item.type !== 'blob') {
      return false;
    }

    if (item.path.startsWith('.git/')) {
      return false;
    }

    // Allow lock files even if they're large
    const isLockFile =
      item.path.endsWith('package-lock.json') ||
      item.path.endsWith('yarn.lock') ||
      item.path.endsWith('pnpm-lock.yaml');

    // For non-lock files, limit size to 100KB
    if (!isLockFile && item.size >= 100000) {
      return false;
    }

    return true;
  });

  // Fetch file contents in batches to avoid overwhelming the API
  const batchSize = 10;
  const fileContents = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchPromises = batch.map(async (file: any) => {
      try {
        const contentResponse = await fetchGithubWithRetry(`${baseUrl}/repos/${repo}/contents/${file.path}`, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'bolt.diy-app',
            ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
          },
        });

        if (!contentResponse.ok) {
          console.warn(`Failed to fetch ${file.path} after retries: ${contentResponse.status}`);
          return null;
        }

        const contentData = (await contentResponse.json()) as any;
        const content = atob(contentData.content.replace(/\s/g, ''));

        return {
          name: file.path.split('/').pop() || '',
          path: file.path,
          content,
        };
      } catch (error) {
        console.warn(`Error fetching ${file.path}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    fileContents.push(...batchResults.filter(Boolean));

    // Add a small delay between batches to be respectful to the API
    if (i + batchSize < files.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return fileContents;
}

// Your existing method for non-Cloudflare environments
async function fetchRepoContentsZip(repo: string, githubToken?: string) {
  const baseUrl = 'https://api.github.com';

  // Get the latest release
  const releaseResponse = await fetchGithubWithRetry(`${baseUrl}/repos/${repo}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'bolt.diy-app',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (releaseResponse.status === 404) {
    throw new GithubTemplateError('not_found', `Repository or release not found: ${repo}`);
  }

  if (!releaseResponse.ok) {
    throw new GithubTemplateError(
      releaseResponse.status === 403 || releaseResponse.status === 429 ? 'rate_limited' : 'transient',
      `Failed to fetch latest release for ${repo}: ${releaseResponse.status} ${releaseResponse.statusText}`,
    );
  }

  const releaseData = (await releaseResponse.json()) as any;
  const zipballUrl = releaseData.zipball_url;

  // Fetch the zipball
  const zipResponse = await fetchGithubWithRetry(zipballUrl, {
    headers: {
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (!zipResponse.ok) {
    throw new GithubTemplateError(
      zipResponse.status === 404
        ? 'not_found'
        : zipResponse.status === 403 || zipResponse.status === 429
          ? 'rate_limited'
          : 'transient',
      `Failed to fetch release zipball for ${repo}: ${zipResponse.status} ${zipResponse.statusText}`,
    );
  }

  // Get the zip content as ArrayBuffer
  const zipArrayBuffer = await zipResponse.arrayBuffer();

  // Use JSZip to extract the contents
  const zip = await JSZip.loadAsync(zipArrayBuffer);

  // Find the root folder name
  let rootFolderName = '';
  zip.forEach((relativePath) => {
    if (!rootFolderName && relativePath.includes('/')) {
      rootFolderName = relativePath.split('/')[0];
    }
  });

  // Extract all files
  const promises = Object.keys(zip.files).map(async (filename) => {
    const zipEntry = zip.files[filename];

    // Skip directories
    if (zipEntry.dir) {
      return null;
    }

    // Skip the root folder itself
    if (filename === rootFolderName) {
      return null;
    }

    // Remove the root folder from the path
    let normalizedPath = filename;

    if (rootFolderName && filename.startsWith(rootFolderName + '/')) {
      normalizedPath = filename.substring(rootFolderName.length + 1);
    }

    // Get the file content
    const content = await zipEntry.async('string');

    return {
      name: normalizedPath.split('/').pop() || '',
      path: normalizedPath,
      content,
    };
  });

  const results = await Promise.all(promises);

  return results.filter(Boolean);
}

export async function loader({ request, context }: { request: Request; context: any }) {
  const url = new URL(request.url);
  const repo = url.searchParams.get('repo');

  if (!repo) {
    return json({ error: 'Repository name is required' }, { status: 400 });
  }

  const requestedHue = Number(url.searchParams.get('hue'));
  const hue =
    Number.isInteger(requestedHue) && requestedHue >= 0 && requestedHue < 360 ? requestedHue : designSchemeToHue();

  try {
    // Access environment variables from Cloudflare context or process.env
    const githubToken =
      context?.cloudflare?.env?.GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_ACCESS_TOKEN;

    let fileList;

    if (isCloudflareEnvironment(context)) {
      fileList = await fetchRepoContentsCloudflare(repo, githubToken);
    } else {
      fileList = await fetchRepoContentsZip(repo, githubToken);
    }

    // Filter out .git files for both methods
    const filteredFiles = fileList.filter((file: any) => !file.path.startsWith('.git'));

    return json(injectCoralredDesignKit(filteredFiles, hue, repo));
  } catch (error) {
    const code: GithubTemplateErrorCode = error instanceof GithubTemplateError ? error.code : 'transient';
    const message = error instanceof Error ? error.message : String(error);

    console.error(`[github-template] repo=${repo} code=${code}: ${message}`);

    const status = code === 'not_found' ? 404 : code === 'rate_limited' ? 429 : 502;

    return json(
      {
        error:
          code === 'not_found'
            ? 'Template repository not found'
            : code === 'rate_limited'
              ? 'GitHub API rate limit exceeded'
              : 'Temporary error fetching template files — please try again',
        code,
        details: message,
      },
      { status },
    );
  }
}
