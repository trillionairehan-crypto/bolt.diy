import { type UIMessage, type TextUIPart } from 'ai';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { IGNORE_PATTERNS, type FileMap } from './constants';
import ignore from 'ignore';
import type { ContextAnnotation } from '~/types/context';

export const extractTextContent = (message: Omit<UIMessage, 'id'>) =>
  message.parts
    ?.filter((part): part is TextUIPart => part.type === 'text')
    .map((part) => part.text)
    .join('') ?? '';

export function extractPropertiesFromMessage(message: Omit<UIMessage, 'id'>): {
  model: string;
  provider: string;
  content: string;
} {
  const textContent = extractTextContent(message);

  const modelMatch = textContent.match(MODEL_REGEX);
  const providerMatch = textContent.match(PROVIDER_REGEX);

  /*
   * Extract model
   * const modelMatch = message.content.match(MODEL_REGEX);
   */
  const model = modelMatch ? modelMatch[1] : DEFAULT_MODEL;

  /*
   * Extract provider
   * const providerMatch = message.content.match(PROVIDER_REGEX);
   */
  const provider = providerMatch ? providerMatch[1] : DEFAULT_PROVIDER.name;

  const cleanedContent = textContent.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '');

  return { model, provider, content: cleanedContent };
}

export function simplifyBoltActions(input: string): string {
  // Using regex to match boltAction tags that have type="file"
  const regex = /(<boltAction[^>]*type="file"[^>]*>)([\s\S]*?)(<\/boltAction>)/g;

  // Replace each matching occurrence
  return input.replace(regex, (_0, openingTag, _2, closingTag) => {
    return `${openingTag}\n          ...\n        ${closingTag}`;
  });
}

export function createFilesContext(files: FileMap, useRelativePath?: boolean) {
  const ig = ignore().add(IGNORE_PATTERNS);
  let filePaths = Object.keys(files);
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace('/home/project/', '');
    return !ig.ignores(relPath);
  });

  const fileContexts = filePaths
    .filter((x) => files[x] && files[x].type == 'file')
    .map((path) => {
      const dirent = files[path];

      if (!dirent || dirent.type == 'folder') {
        return '';
      }

      const codeWithLinesNumbers = dirent.content
        .split('\n')
        // .map((v, i) => `${i + 1}|${v}`)
        .join('\n');

      let filePath = path;

      if (useRelativePath) {
        filePath = path.replace('/home/project/', '');
      }

      return `<boltAction type="file" filePath="${filePath}">${codeWithLinesNumbers}</boltAction>`;
    });

  return `<boltArtifact id="code-content" title="Code Content" >\n${fileContexts.join('\n')}\n</boltArtifact>`;
}

export function extractCurrentContext(messages: UIMessage[]) {
  const lastAssistantMessage = messages.filter((x) => x.role == 'assistant').slice(-1)[0];

  if (!lastAssistantMessage) {
    return { summary: undefined, codeContext: undefined };
  }

  // v5 UIMessage has no `annotations` field — chatSummary/codeContext are now persisted as
  // non-transient `data-*` parts instead (see api.chat.ts), so we read them off `parts`.
  const chatSummaryPart = lastAssistantMessage.parts?.find((p: any) => p.type === 'data-chatSummary') as any;
  const codeContextPart = lastAssistantMessage.parts?.find((p: any) => p.type === 'data-codeContext') as any;

  const summary: ContextAnnotation | undefined = chatSummaryPart
    ? ({ type: 'chatSummary', ...chatSummaryPart.data } as ContextAnnotation)
    : undefined;
  const codeContext: ContextAnnotation | undefined = codeContextPart
    ? ({ type: 'codeContext', ...codeContextPart.data } as ContextAnnotation)
    : undefined;

  return { summary, codeContext };
}
