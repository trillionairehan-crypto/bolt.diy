/**
 * Packages the system prompt (new-prompt.ts, Supabase Client Setup / Payment sections) pins an
 * exact version for and instructs the LLM to import directly. The LLM sometimes writes the
 * import but forgets to add the matching package.json entry — `npm install` then never fetches
 * it, and Vite fails at dev/build time with "Failed to resolve import", blanking the whole app.
 * Keep this map in sync with the versions pinned in new-prompt.ts.
 */
export const KNOWN_PACKAGE_VERSIONS: Record<string, string> = {
  '@supabase/supabase-js': '^2.45.0',
  '@tosspayments/tosspayments-sdk': '^2.7.1',
};

const IMPORT_SPECIFIER_RE = /(?:import\s[\s\S]*?\sfrom\s|require\()\s*['"]([^'"]+)['"]/g;

/**
 * Scans a source file's content for `import ... from '<pkg>'` / `require('<pkg>')` specifiers
 * and returns the subset that match a package in KNOWN_PACKAGE_VERSIONS.
 */
export function extractKnownPackageImports(content: string): Set<string> {
  const found = new Set<string>();

  IMPORT_SPECIFIER_RE.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = IMPORT_SPECIFIER_RE.exec(content)) !== null) {
    const specifier = match[1];

    if (Object.prototype.hasOwnProperty.call(KNOWN_PACKAGE_VERSIONS, specifier)) {
      found.add(specifier);
    }
  }

  return found;
}

/**
 * Given package.json's raw text and a set of required package names, returns the text with any
 * missing entries added under "dependencies" (using the pinned version from
 * KNOWN_PACKAGE_VERSIONS), or the original text unchanged if nothing was missing or the file
 * isn't valid JSON.
 */
export function addMissingDependencies(packageJsonContent: string, requiredPackages: Iterable<string>): string {
  let parsed: any;

  try {
    parsed = JSON.parse(packageJsonContent);
  } catch {
    return packageJsonContent;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return packageJsonContent;
  }

  let changed = false;

  for (const pkg of requiredPackages) {
    const alreadyPresent = parsed.dependencies?.[pkg] || parsed.devDependencies?.[pkg];

    if (!alreadyPresent) {
      parsed.dependencies ??= {};
      parsed.dependencies[pkg] = KNOWN_PACKAGE_VERSIONS[pkg];
      changed = true;
    }
  }

  if (!changed) {
    return packageJsonContent;
  }

  return `${JSON.stringify(parsed, null, 2)}\n`;
}
