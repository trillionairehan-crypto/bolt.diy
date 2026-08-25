import { describe, expect, it } from 'vitest';
import { shouldSwitchToPreviewOnMobileOpen } from './workbenchMobileLayout';

describe('shouldSwitchToPreviewOnMobileOpen', () => {
  it('switches to preview when the workbench transitions from closed to open on a small viewport', () => {
    expect(shouldSwitchToPreviewOnMobileOpen(false, true, true)).toBe(true);
  });

  it('does not switch when the workbench was already open (avoids fighting a tab the user picked)', () => {
    expect(shouldSwitchToPreviewOnMobileOpen(true, true, true)).toBe(false);
  });

  it('does not switch when the workbench is closing, not opening', () => {
    expect(shouldSwitchToPreviewOnMobileOpen(true, false, true)).toBe(false);
  });

  it('does not switch on a wide (desktop) viewport, even on the open transition', () => {
    expect(shouldSwitchToPreviewOnMobileOpen(false, true, false)).toBe(false);
  });

  it('does nothing when the workbench stays closed', () => {
    expect(shouldSwitchToPreviewOnMobileOpen(false, false, true)).toBe(false);
  });
});
