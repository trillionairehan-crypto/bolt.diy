import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { ChatShell } from '~/components/chat/ChatShell';

export async function loader(args: LoaderFunctionArgs) {
  return json({ id: args.params.id });
}

/*
 * 1: /chat/:id는 로그인·게스트 무관하게 항상 채팅 화면을 직접 렌더한다 — _index.tsx의
 * 랜딩(dismissed useState) 게이트를 공유하지 않는다. useState는 마운트마다 리셋되므로
 * 이 라우트가 그 게이트를 재사용하면 매번 랜딩부터 거치게 된다.
 */
export default function ChatByIdRoute() {
  return <ChatShell />;
}
