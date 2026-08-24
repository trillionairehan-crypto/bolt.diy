import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import {
  CloudflareDeployError,
  deployToCloudflarePages,
  injectMadeWithBadge,
  type CloudflareDeployFile,
} from '~/lib/services/cloudflarePages';

interface DeployRequestBody {
  projectName: string;

  /** path -> base64-encoded file content (binary-safe, unlike the plain-text Netlify/Vercel flows). */
  files: Record<string, string>;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/** 해요체 error copy per file, keyed by the case it covers — never leaks raw Cloudflare error text to the user. */
function toUserMessage(error: unknown): { message: string; status: number } {
  if (error instanceof CloudflareDeployError) {
    if (error.status === 401) {
      return { message: '코랄레드 배포 설정에 문제가 있어요. 잠시 후 다시 시도해주세요.', status: 502 };
    }

    if (error.status === 403) {
      return { message: '배포 권한이 부족해요. 코랄레드 팀에 문의해주세요.', status: 502 };
    }

    if (error.message.includes('파일이')) {
      // File-size / empty-files messages are already user-facing Korean copy — pass through as-is.
      return { message: error.message, status: 400 };
    }

    return { message: '배포에 실패했어요. 잠시 후 다시 시도해주세요.', status: 502 };
  }

  return { message: '배포에 실패했어요. 잠시 후 다시 시도해주세요.', status: 500 };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const accountId = context?.cloudflare?.env?.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = context?.cloudflare?.env?.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return json({ error: '지금은 배포 기능을 사용할 수 없어요. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }

  let body: DeployRequestBody;

  try {
    body = (await request.json()) as DeployRequestBody;
  } catch {
    return json({ error: '요청을 처리하지 못했어요.' }, { status: 400 });
  }

  const { projectName, files } = body;

  if (!projectName || !/^[a-z0-9-]{1,58}$/.test(projectName)) {
    return json({ error: '프로젝트 이름이 올바르지 않아요.' }, { status: 400 });
  }

  if (!files || Object.keys(files).length === 0) {
    return json({ error: '배포할 파일이 없어요. 먼저 빌드가 성공했는지 확인해주세요.' }, { status: 400 });
  }

  // See injectMadeWithBadge's own TODO — unconditional until a real tier lookup exists.
  let deployFiles: CloudflareDeployFile[];

  try {
    deployFiles = Object.entries(files).map(([path, base64Content]) => {
      const normalizedPath = path.replace(/^\/+/, '');

      if (normalizedPath.toLowerCase().endsWith('.html')) {
        const html = new TextDecoder().decode(base64ToBytes(base64Content));
        return { path: normalizedPath, content: new TextEncoder().encode(injectMadeWithBadge(html)) };
      }

      return { path: normalizedPath, content: base64ToBytes(base64Content) };
    });
  } catch {
    return json({ error: '파일 데이터가 손상됐어요. 다시 빌드한 뒤 시도해주세요.' }, { status: 400 });
  }

  try {
    const result = await deployToCloudflarePages({ accountId, apiToken, projectName, files: deployFiles });
    return json({
      success: true,
      url: result.url,
      deploymentId: result.deploymentId,
      projectName: result.projectName,
      isFirstDeploy: result.isFirstDeploy,
    });
  } catch (error) {
    console.error('Cloudflare Pages deploy error:', error instanceof Error ? error.message : error);

    const { message, status } = toUserMessage(error);

    return json({ error: message }, { status });
  }
}
