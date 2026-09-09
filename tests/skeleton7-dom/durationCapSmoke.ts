/*
 * 출시 블로커(2026-09-09) 수정 스모크 — api.chat.ts에 추가한 duration-cap/Sentry 계측이 정상
 * 경로(스톨 없음)에서 런타임 에러 없이 그대로 완료되는지만 확인한다. 실제 3분 상한 트리거는
 * 별도로 재현하지 않음(현실적으로 3분을 기다려야 해서 비용/시간 대비 낮은 가치).
 */
import { callChat, userMessage } from '../benchmark/chatClient.ts';

async function main() {
  const messages = [userMessage('claude-sonnet-5', 'Anthropic', '버튼 색을 파란색으로 바꿔줘')];
  const result = await callChat({
    baseUrl: 'http://localhost:5173',
    messages,
    files: { '/home/project/src/App.tsx': 'function App() { return <button>hi</button>; }' },
    chatId: `duration-cap-smoke-${Date.now()}`,
  });

  console.log('httpStatus:', result.httpStatus);
  console.log('errorText:', result.errorText);
  console.log('elapsedSec:', result.elapsedSec);
  console.log('textLength:', result.text.length);

  if (result.httpStatus !== 200 || result.errorText) {
    console.log('FAIL');
    process.exit(1);
  }

  console.log('PASS — normal generation completed with the new instrumentation in place');
}

main().catch((err) => {
  console.error('ERROR', err);
  process.exit(1);
});
