import { atom } from 'nanostores';

/**
 * 모바일 전용 레이아웃 (overnight5) — which of the two full-screen mobile tabs is showing:
 * chat ("대화") or the generated app's live preview ("미리보기"). Deliberately separate from
 * workbenchStore.showWorkbench/currentView — those describe the desktop split-panel workbench,
 * which mobile no longer renders at all. Keeping this as its own store means Workbench.client.tsx
 * (desktop-only in practice now) and MobileWorkspace.tsx don't have to coordinate through shared
 * state that means different things in each context.
 */
export type MobileTab = 'chat' | 'preview';

export const mobileActiveTabStore = atom<MobileTab>('chat');
