import { json } from '@remix-run/cloudflare';
import JSZip from 'jszip';
import coralredUiCss from '../../design-handoff/coralred-ui.css?raw';
import { designSchemeToHue } from '~/utils/paletteToHue';

const CORALRED_HEAD_MARKER = 'coralred-ui.css';

const CORALRED_HEAD_INJECTION = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
    <link rel="stylesheet" href="/coralred-ui.css">
  `;

const CORALRED_BOLT_PROMPT = `By default, this template uses the Coralred design kit (coralred-ui.css, already linked in index.html's <head>).

Use ONLY cr- classes and the kit's CSS variables (--hue, --accent, --bg, --text, --border, etc.) for all styling. Do NOT use Tailwind classes — this template does not use Tailwind. Never write raw color values (hex/rgb/oklch) or arbitrary px sizes; everything comes from the kit.

--hue is already set on <body> in index.html. Never change it, never add your own color logic on top of it.

Use icons from lucide-react for logos.

Use stock photos from Pexels (NEVER Unsplash) where appropriate, only valid URLs you know exist. Do not download the images, only link to them in image tags.
`;

const CORALRED_INDEX_CSS = `/* Project-specific custom styles go here.
   The Coralred design kit (coralred-ui.css) is already loaded in index.html's <head> —
   don't redeclare cr- classes or kit CSS variables (--hue, --accent, --bg, etc.) here. */
`;

const CORALRED_APP_TSX = `import { Sparkles } from 'lucide-react';

function App() {
  return (
    <div className="cr-page">
      <section className="cr-section cr-stack-16">
        <span className="cr-eyebrow">CORALRED KIT</span>
        <h1 className="cr-h1">Start prompting (or editing) to see magic happen :)</h1>
        <p className="cr-body">
          This starter uses the Coralred design kit — style everything with cr- classes and the
          kit's CSS variables. Never raw colors, never arbitrary px sizes.
        </p>
        <button className="cr-btn">
          <Sparkles size={16} />
          Get started
        </button>
      </section>
    </div>
  );
}

export default App;
`;

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

/**
 * Injects the Coralred design kit into a fetched template:
 * - font links + coralred-ui.css into index.html's <head>
 * - the computed --hue value directly into index.html's <body> (never left for the LLM to guess)
 * - coralred-ui.css itself as a new file
 * - .bolt/prompt replaced with kit-based instructions (added if the template doesn't have one)
 * - the template's stock Tailwind wiring removed and its stub App.tsx replaced
 * All of the above (except font links/coralred-ui.css/--hue) are skipped for shadcn templates,
 * since shadcn/ui — and the "don't use Tailwind" instruction — would directly contradict it.
 * Head/body/CSS injection is skipped when the template has no root index.html (e.g. Next.js,
 * Astro, Remix, SvelteKit templates) so nothing is left orphaned.
 */
function injectCoralredDesignKit(files: { name: string; path: string; content: string }[], hue: number, repo: string) {
  const isShadcn = isShadcnTemplate(repo);
  let result = isShadcn ? files : stripTailwindWiring(files);

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
  const repoResponse = await fetch(`${baseUrl}/repos/${repo}`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'bolt.diy-app',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (!repoResponse.ok) {
    throw new Error(`Repository not found: ${repo}`);
  }

  const repoData = (await repoResponse.json()) as any;
  const defaultBranch = repoData.default_branch;

  // Get the tree recursively
  const treeResponse = await fetch(`${baseUrl}/repos/${repo}/git/trees/${defaultBranch}?recursive=1`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'bolt.diy-app',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch repository tree: ${treeResponse.status}`);
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
        const contentResponse = await fetch(`${baseUrl}/repos/${repo}/contents/${file.path}`, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'bolt.diy-app',
            ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
          },
        });

        if (!contentResponse.ok) {
          console.warn(`Failed to fetch ${file.path}: ${contentResponse.status}`);
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
  const releaseResponse = await fetch(`${baseUrl}/repos/${repo}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'bolt.diy-app',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (!releaseResponse.ok) {
    throw new Error(`GitHub API error: ${releaseResponse.status} - ${releaseResponse.statusText}`);
  }

  const releaseData = (await releaseResponse.json()) as any;
  const zipballUrl = releaseData.zipball_url;

  // Fetch the zipball
  const zipResponse = await fetch(zipballUrl, {
    headers: {
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (!zipResponse.ok) {
    throw new Error(`Failed to fetch release zipball: ${zipResponse.status}`);
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
  const hue = Number.isInteger(requestedHue) && requestedHue >= 0 && requestedHue < 360 ? requestedHue : designSchemeToHue();

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
    console.error('Error processing GitHub template:', error);
    console.error('Repository:', repo);
    console.error('Error details:', error instanceof Error ? error.message : String(error));

    return json(
      {
        error: 'Failed to fetch template files',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
