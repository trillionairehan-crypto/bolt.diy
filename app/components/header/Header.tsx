import { lazy, Suspense } from 'react';
import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { sidebarOpenStore, toggleSidebar, setSidebarOpen } from '~/lib/stores/sidebar';
import { authUserStore } from '~/lib/stores/auth';
import { profileStore } from '~/lib/stores/profile';
import { classNames } from '~/utils/classNames';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { Logo } from '~/components/ui/Logo';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { DeployButton } from '~/components/deploy/DeployButton';
import { SupabaseConnection } from '~/components/chat/SupabaseConnection';
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

const LANDING_TEXT_COLOR = '#FAF7F0';

export function Header() {
  const chat = useStore(chatStore);
  const sidebarOpen = useStore(sidebarOpenStore);
  const authUser = useStore(authUserStore);
  const profile = useStore(profileStore);
  const isSmallViewport = useViewport(1024);
  const isMobileWorkspace = chat.started && isSmallViewport;

  /*
   * The landing hero is a full-bleed coral section — the header sits directly above it in normal
   * document flow (not layered), so it needs its own matching coral background, not `transparent`,
   * to read as one continuous surface instead of a white bar over a coral block.
   */
  const isLanding = !chat.started;

  return (
    <>
      <header
        className={classNames('flex items-center px-4 border-b h-[var(--header-height)]', {
          'border-transparent': isLanding,
          'border-bolt-elements-borderColor': chat.started,
        })}
        style={isLanding ? { background: '#FF5330' } : undefined}
      >
        <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
          {!isLanding && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="사이드바 열기/닫기"
              aria-expanded={sidebarOpen}
              className="i-ph:sidebar-simple-duotone text-xl"
            />
          )}
          <a href="/" className="flex items-center gap-2">
            <Logo height={isMobileWorkspace ? 20 : 24} variant={isLanding ? 'onCoral' : 'default'} />
          </a>
        </div>

        {isLanding && (
          <div className="flex-1 flex items-center justify-end gap-5">
            <a href="/pricing" className="text-sm font-medium hover:opacity-80" style={{ color: LANDING_TEXT_COLOR }}>
              요금제
            </a>
            {/* 다크모드 출시 제외 (overnight5, DEV_UI_HIDE_REPORT.md) — DARK_MODE_ENABLED로 전체 숨김. */}
            {DARK_MODE_ENABLED && !isSmallViewport && <ThemeSwitch className="!text-[#FAF7F0] hover:!opacity-80" />}
            {authUser ? (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                title="내 프로젝트"
                className="flex items-center gap-2 text-sm font-semibold rounded-full pl-1.5 pr-1.5 py-1.5 sm:pl-4 hover:opacity-90 transition-opacity"
                style={{ background: '#FAF7F0', color: '#FF5330' }}
              >
                <span className="hidden sm:inline">내 프로젝트</span>
                <span className="flex items-center justify-center w-6 h-6 rounded-full overflow-hidden bg-[#FF5330]/15 shrink-0">
                  {profile?.avatar ? (
                    <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="i-ph:user-fill text-xs" style={{ color: '#FF5330' }} />
                  )}
                </span>
              </button>
            ) : (
              <a
                href="/login"
                className="text-sm font-semibold rounded-full px-4 py-1.5 hover:opacity-90 transition-opacity"
                style={{ background: '#FAF7F0', color: '#FF5330' }}
              >
                로그인
              </a>
            )}
          </div>
        )}

        {chat.started && ( // Display ChatDescription and HeaderActionButtons only when the chat has started.
          <>
            <span className="flex-1 min-w-0 px-4 truncate text-center text-bolt-elements-textPrimary">
              <ClientOnly>{() => <ChatDescription />}</ClientOnly>
            </span>
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
        )}
      </header>
    </>
  );
}
