import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import { addCustomDomain, CloudflareDeployError, getCustomDomainStatus } from '~/lib/services/cloudflarePages';

const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

function getCredentials(context: ActionFunctionArgs['context'] | LoaderFunctionArgs['context']) {
  const accountId = context?.cloudflare?.env?.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = context?.cloudflare?.env?.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  return { accountId, apiToken };
}

function toUserMessage(error: unknown): { message: string; status: number } {
  if (error instanceof CloudflareDeployError) {
    if (error.status === 403) {
      return { message: '도메인 권한 설정이 필요해요. 코랄레드 팀에 문의해주세요.', status: 502 };
    }

    if (error.status === 401) {
      return { message: '코랄레드 배포 설정에 문제가 있어요. 잠시 후 다시 시도해주세요.', status: 502 };
    }

    return { message: '도메인 연결에 실패했어요. 도메인 주소를 확인해주세요.', status: 400 };
  }

  return { message: '도메인 연결에 실패했어요. 잠시 후 다시 시도해주세요.', status: 500 };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { accountId, apiToken } = getCredentials(context);

  if (!accountId || !apiToken) {
    return json({ error: '지금은 도메인 연결 기능을 사용할 수 없어요. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }

  let body: { projectName?: string; domain?: string };

  try {
    body = (await request.json()) as { projectName?: string; domain?: string };
  } catch {
    return json({ error: '요청을 처리하지 못했어요.' }, { status: 400 });
  }

  const { projectName, domain } = body;

  if (!projectName) {
    return json({ error: '프로젝트를 찾지 못했어요.' }, { status: 400 });
  }

  if (!domain || domain.length > 253 || !DOMAIN_PATTERN.test(domain)) {
    return json({ error: '도메인 주소가 올바르지 않아요. 예: myapp.com' }, { status: 400 });
  }

  try {
    const result = await addCustomDomain(accountId, apiToken, projectName, domain.toLowerCase());
    return json({ success: true, ...result });
  } catch (error) {
    console.error('Cloudflare custom domain error:', error instanceof Error ? error.message : error);

    const { message, status } = toUserMessage(error);

    return json({ error: message }, { status });
  }
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { accountId, apiToken } = getCredentials(context);

  if (!accountId || !apiToken) {
    return json({ error: '지금은 도메인 연결 기능을 사용할 수 없어요.' }, { status: 503 });
  }

  const url = new URL(request.url);
  const projectName = url.searchParams.get('projectName');
  const domain = url.searchParams.get('domain');

  if (!projectName || !domain) {
    return json({ error: '요청이 올바르지 않아요.' }, { status: 400 });
  }

  try {
    const result = await getCustomDomainStatus(accountId, apiToken, projectName, domain);
    return json({ success: true, ...result });
  } catch (error) {
    console.error('Cloudflare custom domain status error:', error instanceof Error ? error.message : error);

    const { message, status } = toUserMessage(error);

    return json({ error: message }, { status });
  }
}
