export function buildFixPrompt(isPreview: boolean, content: string): string {
  return `*이 ${isPreview ? '미리보기' : '터미널'} 오류를 고쳐줘* \n\`\`\`${isPreview ? 'js' : 'sh'}\n${content}\n\`\`\`\n`;
}
