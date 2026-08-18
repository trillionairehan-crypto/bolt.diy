const REACT_NAMESPACE_USAGE = /\bReact\.[A-Za-z]/;
const REACT_DEFAULT_OR_NAMESPACE_IMPORT =
  /^\s*import\s+(?:\*\s+as\s+React\b|React\b)(?:\s*,\s*\{[^}]*\})?\s+from\s+['"]react['"]/m;
const LEADING_USE_CLIENT_DIRECTIVE = /^\s*(['"])use client\1;?\s*\r?\n/;

/**
 * Auto-fixes generated .tsx/.jsx content that references the React namespace
 * (React.useState, React.FC, etc.) without importing React. The automatic JSX
 * runtime doesn't provide a global React identifier, so this throws
 * "React is not defined" in the WebContainer preview if left unfixed.
 */
export function postProcessReactFile(filePath: string, content: string): string {
  if (!REACT_NAMESPACE_USAGE.test(content)) {
    return content;
  }

  if (REACT_DEFAULT_OR_NAMESPACE_IMPORT.test(content)) {
    return content;
  }

  const directiveMatch = content.match(LEADING_USE_CLIENT_DIRECTIVE);
  const insertAt = directiveMatch ? directiveMatch[0].length : 0;

  const before = content.slice(0, insertAt);
  const after = content.slice(insertAt);

  console.log(
    `[postProcessReactFile] ${filePath}: found React.* namespace usage without a React import — inserted "import React from 'react';"`,
  );

  return `${before}import React from 'react';\n${after}`;
}
