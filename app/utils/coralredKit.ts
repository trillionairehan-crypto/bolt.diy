/**
 * Shared Coralred design kit content — the single source of truth for both:
 * - api.github-template.ts, which injects these into a fetched GitHub starter template
 * - selectStarterTemplate.ts's baseline template, used when no GitHub template applies
 *   (blank selection, or a failed fetch) so the kit is never skipped either way.
 */
import coralredUiCss from '~design-handoff/coralred-ui.css?raw';

export { coralredUiCss };

export const CORALRED_HEAD_MARKER = 'coralred-ui.css';

export const CORALRED_HEAD_INJECTION = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
    <link rel="stylesheet" href="/coralred-ui.css">
  `;

export const CORALRED_BOLT_PROMPT = `By default, this template uses the Coralred design kit (coralred-ui.css, already linked in index.html's <head>).

Use ONLY cr- classes and the kit's CSS variables (--hue, --accent, --bg, --text, --border, etc.) for all styling. Do NOT use Tailwind classes — this template does not use Tailwind. Never write raw color values (hex/rgb/oklch) or arbitrary px sizes; everything comes from the kit.

--hue is already set on <body> in index.html. Never change it, never add your own color logic on top of it.

Use icons from lucide-react for logos.

Never insert an external stock-photo or placeholder-service URL (Pexels, Unsplash, placehold.co, picsum.photos, or any other such service) for a photo slot the user hasn't supplied a real image for — an unverifiable external URL can go dead, get rate-limited, or serve the wrong image at any time, and you cannot see what it actually shows. Use the coralred image placeholder pattern instead (see the main system prompt's image_placeholder_rules): #FFF4EF background, a small inline SVG line-icon, and the caption "사진을 보내주시면 여기에 넣어드릴게요" for anything bigger than an 80px slot. Swap in a real photo only once the user actually attaches one.
`;

export const CORALRED_INDEX_CSS = `/* Project-specific custom styles go here.
   The Coralred design kit (coralred-ui.css) is already loaded in index.html's <head> —
   don't redeclare cr- classes or kit CSS variables (--hue, --accent, --bg, etc.) here. */
`;

export const CORALRED_APP_TSX = `import { Sparkles } from 'lucide-react';

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
