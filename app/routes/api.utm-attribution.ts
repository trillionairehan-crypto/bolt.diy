import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import { getPlatformUserId } from '~/lib/cloud/cloudPlatformAuth';
import { recordUtmAttributionInBackground } from '~/lib/cloud/utmAttribution';

/**
 * 첫 가입 시점의 UTM 유입 경로 저장 전용 라우트 — auth.ts가 "방금 새로 가입한 사용자"를 감지했을 때
 * 한 번 fire-and-forget으로 호출한다. 로그인한 사용자여야만 의미가 있으므로(레코드가 user_id에
 * 묶임) 게스트(userId 없음)는 온보딩과 달리 그냥 401로 막는다.
 */
export async function action({ context, request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const userId = await getPlatformUserId(request).catch(() => null);

  if (!userId) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json<{
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmContent?: string | null;
  }>();

  recordUtmAttributionInBackground(
    {
      userId,
      utmSource: body.utmSource ?? null,
      utmMedium: body.utmMedium ?? null,
      utmCampaign: body.utmCampaign ?? null,
      utmContent: body.utmContent ?? null,
    },
    context.cloudflare?.env as any,
    context.cloudflare?.ctx,
  );

  return json({ ok: true }, { status: 200 });
}
