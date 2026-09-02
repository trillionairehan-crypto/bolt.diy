import { lazy, Suspense } from 'react';
import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { DeployButton } from '~/components/deploy/DeployButton';
import { SupabaseConnection } from '~/components/chat/SupabaseConnection';
import { Logo } from '~/components/ui/Logo';
import { toggleSidebar } from '~/lib/stores/sidebar';
import useViewport from '~/lib/hooks';
import { DARK_MODE_ENABLED } from '~/utils/featureFlags';

/*
 * Lazy-loaded: HeaderActionButtons only imports `workbenchStore` to read `previews` for the
 * Deploy button, but that store module eagerly instantiates a singleton pulling in ActionRunner,
 * EditorStore, FilesStore, PreviewsStore, TerminalStore, JSZip, Octokit, and the WebContainer
 * bootstrap. Header renders unconditionally on the main route, so a static import here forced
 * that entire workbench dependency graph into the initial page-load bundle (~1MB gzipped, all
 * under a single "Header" chunk) before the user ever opens the workbench. This defers that cost
 * to when HeaderActionButtons actually mounts (chat.started === true). The ideal fix is a
 * lighter-weight selector that doesn't require importing the whole store module at all — this is
 * the quick, low-risk mitigation in the meantime.
 */
const HeaderActionButtons = lazy(() =>
  import('./HeaderActionButtons.client').then((module) => ({ default: module.HeaderActionButtons })),
);

export function Header() {
  const chat = useStore(chatStore);
  const isSmallViewport = useViewport(1024);
  const isMobileWorkspace = chat.started && isSmallViewport;

  return (
    <header
      className="flex items-center gap-3 px-4 border-b h-[var(--header-height)]"
      style={{ background: '#FBF5EE', borderColor: 'rgba(26, 26, 26, 0.08)', color: '#1A1A1A' }}
    >
      {/*
        모바일(<1024px, Menu.client.tsx의 데스크톱 레일과 정확히 같은 기준 — 그 사이에 사이드바를
        열 방법이 하나도 없는 폭이 생기면 안 된다)에서는 데스크톱 레일의 고정 로고/햄버거가 아예
        렌더되지 않아(!isSmallViewport 조건) 사이드바를 열 방법이 없었다 — 헤더 왼쪽에 대신 넣는다.
        data-sidebar-toggle: Menu.client.tsx의 바깥클릭-닫힘 리스너가 이 버튼 클릭을 "바깥"으로
        오인해 열자마자 닫아버리지 않도록 제외 표시.
      */}
      {isSmallViewport && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            aria-label="메뉴"
            data-sidebar-toggle
            className="flex items-center justify-center"
            style={{ color: '#1A1A1A', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            onClick={toggleSidebar}
          >
            <span className="i-ph:list" style={{ fontSize: 24 }} />
          </button>
          <a href="/" aria-label="홈" className="flex items-center">
            <Logo height={20} showWordmark={false} />
          </a>
        </div>
      )}
      {chat.started ? (
        <>
          {/* 앱 제목(연필 아이콘 포함)은 헤더에서 제거 — 사이드바에서 확인 가능하다. */}
          <div className="flex-1" />
          {/* 모바일 전용 레이아웃(isMobileWorkspace) — 테마 토글/디버그 도구는 여전히 없음. 저장 기능
              켜기는 TRUST_FIX_REPORT.md 작업 4로 아이콘 버튼(showLabel={false})만 추가 — 헤더가
              좁아 라벨까지 넣으면 배포하기 버튼과 겹치고, 이 기능은 배포 제공자 드롭다운과 성격이
              달라(SHOW_DEV_TOOLS로 가려진 그 드롭다운에 억지로 넣는 것보다) 데스크톱과 같은 자기
              버튼을 그대로 축소해서 쓰는 쪽이 자연스럽다. */}
          <ClientOnly>
            {() =>
              isMobileWorkspace ? (
                <div className="flex items-center gap-1">
                  <SupabaseConnection showLabel={false} />
                  <DeployButton />
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  {DARK_MODE_ENABLED && <ThemeSwitch />}
                  <Suspense fallback={null}>
                    <HeaderActionButtons chatStarted={chat.started} />
                  </Suspense>
                </div>
              )
            }
          </ClientOnly>
        </>
      ) : (
        <div className="flex-1" />
      )}
    </header>
  );
}
