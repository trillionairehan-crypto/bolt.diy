import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import { getPlatformUserId } from '~/lib/cloud/cloudPlatformAuth';
import { recordOnboardingResponseInBackground } from '~/lib/cloud/onboardingResponses';

/**
 * 온보딩 설문(Q1~Q5) 저장 전용 라우트 — PromptClarification.tsx가 "만들기"를 누른 시점에 한 번
 * fire-and-forget으로 호출한다(응답을 기다리지 않는다). api.chat.ts의 채팅 생성 흐름과는 완전히
 * 분리돼 있어, 여기서 실패하거나 느려도 생성 자체에는 영향이 없다.
 */
export async function action({ context, request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json<{
    chatId?: string;
    q1Audience?: string | null;
    q2Storage?: string | null;
    q3Industry?: string | null;
    q3Raw?: string | null;
    q3MappedSkeleton?: number | null;
    q4Integrations?: string[];
    q5Palette?: string | null;
  }>();

  if (!body.chatId) {
    // chat_id 없이는 어느 대화의 설문인지 특정할 수 없다 — 조용히 건너뛴다(non-fatal).
    return json({ ok: false, reason: 'missing chatId' }, { status: 200 });
  }

  const userId = await getPlatformUserId(request).catch(() => null);

  recordOnboardingResponseInBackground(
    {
      userId,
      chatId: body.chatId,
      q1Audience: body.q1Audience ?? null,
      q2Storage: body.q2Storage ?? null,
      q3Industry: body.q3Industry ?? null,
      q3Raw: body.q3Raw ?? null,
      q3MappedSkeleton: body.q3MappedSkeleton ?? null,
      q4Integrations: body.q4Integrations ?? [],
      q5Palette: body.q5Palette ?? null,
    },
    context.cloudflare?.env as any,
    context.cloudflare?.ctx,
  );

  return json({ ok: true }, { status: 200 });
}
