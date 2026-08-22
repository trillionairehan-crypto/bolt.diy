/**
 * The LLM sometimes imports a relative file it never actually writes in the same artifact — see
 * dependency-postprocess.ts for the analogous, already-shipped problem with npm packages. Vite's
 * dev server does eventually surface this too (the same "Failed to resolve import" class of error
 * that the VITE_COMPILE_ERROR detection in inspector-script.js/Preview.tsx already watches for),
 * but only reactively: after the dev server is already running, and only for files the live
 * import graph actually reaches (a written-but-never-imported dead file, or an import branch the
 * app doesn't hit on first render, would never trigger it). This module does the same check
 * proactively against the full file set of a just-closed artifact, so it can catch it earlier and
 * more completely, and name the exact missing file/line instead of relying on Vite's error text.
 */

import { path } from '~/utils/path';

export interface MissingImportRef {
  /** Absolute (WORK_DIR-based) path of the file that contains the broken import. */
  importerPath: string;
  /** The raw specifier as written, e.g. './lib/supabase'. */
  specifier: string;
  /** 1-based line number the import appears on in the importer's content. */
  line: number;
}

const SCANNABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function isScannableSourceFile(filePath: string): boolean {
  return SCANNABLE_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

/*
 * Matches the specifier in `import ... from '<path>'`, `export ... from '<path>'`,
 * `import('<path>')`, and `require('<path>')` — but only relative specifiers (starting with
 * `.`), so bare package names (react, lucide-react, ...) never match here; those are
 * dependency-postprocess.ts's problem, not this module's.
 */
const RELATIVE_IMPORT_RE =
  /(?:\b(?:import|export)\b[\s\S]*?\sfrom\s|\bimport\s*\(|\brequire\s*\()\s*['"](\.[^'"]*)['"]/g;

/** Extracts relative import/re-export/dynamic-import/require specifiers with their line numbers. */
export function extractRelativeImports(content: string): Array<{ specifier: string; line: number }> {
  const refs: Array<{ specifier: string; line: number }> = [];

  RELATIVE_IMPORT_RE.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = RELATIVE_IMPORT_RE.exec(content)) !== null) {
    const specifier = match[1];
    const line = content.slice(0, match.index).split('\n').length;
    refs.push({ specifier, line });
  }

  return refs;
}

const RESOLVABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const INDEX_SUFFIXES = RESOLVABLE_EXTENSIONS.map((ext) => `/index${ext}`);

function hasExplicitExtension(specifier: string): boolean {
  const lastSegment = specifier.split('/').pop() ?? '';
  return /\.[a-zA-Z0-9]+$/.test(lastSegment);
}

/**
 * Resolves a relative specifier against `importerDir` (the importing file's directory) and
 * checks it against `fileExists`: the exact path first, then — only for extension-less
 * specifiers, matching how bundlers actually resolve them — each of RESOLVABLE_EXTENSIONS and an
 * index file under a directory of that name. A specifier that already has an explicit extension
 * (e.g. './styles.css') is checked exactly and never extension-guessed.
 */
export function resolveRelativeImport(
  importerDir: string,
  specifier: string,
  fileExists: (absolutePath: string) => boolean,
): boolean {
  const base = path.normalize(path.join(importerDir, specifier));

  if (fileExists(base)) {
    return true;
  }

  if (hasExplicitExtension(specifier)) {
    return false;
  }

  for (const ext of RESOLVABLE_EXTENSIONS) {
    if (fileExists(base + ext)) {
      return true;
    }
  }

  for (const suffix of INDEX_SUFFIXES) {
    if (fileExists(base + suffix)) {
      return true;
    }
  }

  return false;
}

/**
 * Scans a set of just-written files (absolute path + content) for relative imports that don't
 * resolve to any file `fileExists` reports as present. Only files with a recognized source
 * extension are scanned as importers (no point regex-scanning package.json or a .sql migration
 * for "import"-shaped text). Returns one MissingImportRef per broken import found — an importer
 * can appear more than once if it has more than one broken import.
 */
export function findMissingRelativeImports(
  writtenFiles: Array<{ path: string; content: string }>,
  fileExists: (absolutePath: string) => boolean,
): MissingImportRef[] {
  const missing: MissingImportRef[] = [];

  for (const file of writtenFiles) {
    if (!isScannableSourceFile(file.path)) {
      continue;
    }

    const importerDir = path.dirname(file.path);
    const refs = extractRelativeImports(file.content);

    for (const ref of refs) {
      if (!resolveRelativeImport(importerDir, ref.specifier, fileExists)) {
        missing.push({ importerPath: file.path, specifier: ref.specifier, line: ref.line });
      }
    }
  }

  return missing;
}

/**
 * Formats a list of missing imports into an ActionAlert-shaped {description, content} pair.
 * `description` is a short summary (shown in the ChatAlert UI); `content` is the detailed,
 * per-import breakdown that goes into the auto-fix prompt via buildFixPrompt.
 */
export function formatMissingImportsAlert(
  missing: MissingImportRef[],
  workdir: string,
): { description: string; content: string } {
  const toRelative = (absolutePath: string) => path.relative(workdir, absolutePath) || absolutePath;

  const first = missing[0];
  const firstRelative = toRelative(first.importerPath);

  const description =
    missing.length === 1
      ? `${firstRelative}에서 import한 '${first.specifier}' 파일이 없어요`
      : `${firstRelative} 등에서 import한 파일 ${missing.length}개가 없어요`;

  const lines = missing.map((ref) => `- ${toRelative(ref.importerPath)}:${ref.line} imports '${ref.specifier}', but no file was written for it`);

  const content = [
    'The following relative imports point to files that were never created in this response:',
    ...lines,
    '',
    'Create the missing file(s) with appropriate content, or fix the import path if it was a typo/wrong relative depth.',
  ].join('\n');

  return { description, content };
}
