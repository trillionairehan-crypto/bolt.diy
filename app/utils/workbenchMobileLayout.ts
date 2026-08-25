/**
 * Mobile workbench layout fix (overnight5): on a narrow viewport the workbench opens as a
 * full-screen takeover rather than a side-by-side panel, and per the fix's spec, non-developer
 * users should land on the "미리보기" tab rather than "코드" when they open it — but only on the
 * transition from closed to open, so it doesn't fight a tab the user already picked while it's
 * open. Extracted as a pure function because Workbench.client.tsx has no component-render test
 * infra (see Workbench.colors.spec.ts) — this isolates the one piece of that effect's logic that
 * can actually be unit tested.
 */
export function shouldSwitchToPreviewOnMobileOpen(
  wasOpen: boolean,
  isOpen: boolean,
  isSmallViewport: boolean,
): boolean {
  return !wasOpen && isOpen && isSmallViewport;
}
