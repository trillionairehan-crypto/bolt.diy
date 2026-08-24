const MAX_BUILD_OUTPUT_CHARS = 4000;

export function formatBuildFailureOutput(output?: string) {
  const trimmed = output?.trim();

  if (!trimmed) {
    return '빌드에 실패했어요. 출력 내용은 남지 않았어요.';
  }

  if (trimmed.length <= MAX_BUILD_OUTPUT_CHARS) {
    return trimmed;
  }

  return `빌드 출력 (일부만 표시):\n${trimmed.slice(-MAX_BUILD_OUTPUT_CHARS)}`;
}
