/*
 * shadow-qa 전용 — 픽스처(플랫 파일맵)를 실제 빌드해 데스크톱(1280×800)/모바일(390×844) 스크린샷
 * 두 장을 찍는다. tests/skeleton7-dom/renderFixture.ts의 buildAndServeFixture를 그대로 재사용한다
 * (vite build -> 정적 서버) — 새 렌더링 경로를 만들지 않는다.
 */
import { chromium } from 'playwright';
import { buildAndServeFixture, type FixtureRecord } from '../../skeleton7-dom/renderFixture.ts';

export interface CapturedScreenshots {
  desktopBase64: string;
  mobileBase64: string;
  desktopDataUrl: string;
  mobileDataUrl: string;
}

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

export async function captureScreenshots(name: string, files: FixtureRecord): Promise<CapturedScreenshots> {
  const browser = await chromium.launch();
  let server: { url: string; close: () => Promise<void> } | null = null;

  try {
    server = await buildAndServeFixture(name, files);

    const desktopPage = await browser.newPage({ viewport: DESKTOP_VIEWPORT });
    await desktopPage.goto(server.url, { waitUntil: 'networkidle' });

    const desktopBuf = await desktopPage.screenshot({ type: 'png' });
    await desktopPage.close();

    const mobilePage = await browser.newPage({ viewport: MOBILE_VIEWPORT });
    await mobilePage.goto(server.url, { waitUntil: 'networkidle' });

    const mobileBuf = await mobilePage.screenshot({ type: 'png' });
    await mobilePage.close();

    const desktopBase64 = desktopBuf.toString('base64');
    const mobileBase64 = mobileBuf.toString('base64');

    return {
      desktopBase64,
      mobileBase64,
      desktopDataUrl: `data:image/png;base64,${desktopBase64}`,
      mobileDataUrl: `data:image/png;base64,${mobileBase64}`,
    };
  } finally {
    if (server) {
      await server.close();
    }

    await browser.close();
  }
}
