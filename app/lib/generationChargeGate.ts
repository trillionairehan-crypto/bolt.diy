/**
 * One-shot charge gate for a chat generation.
 *
 * METERING_FIX_REPORT.md: the free/paid generation credit used to be deducted right before the
 * request was sent, so a stall, cancellation, or network/server error still cost the user a
 * credit even though they got nothing for it. This gate moves the charge to the moment the
 * generation actually finishes, and only fires it on a genuine success:
 *
 *   1. Call `arm()` immediately before the request is actually sent.
 *   2. Call `onFinish({ isAbort, isError })` from the chat's onFinish callback (which fires for
 *      every outcome — success, abort, and error alike).
 *
 * `chargeFn` runs only when armed and the finish was neither aborted nor an error, and only once
 * per `arm()` call no matter how many times `onFinish` is invoked afterward — a second call
 * after an already-consumed arm (e.g. an unrelated later generation's finish) is a no-op.
 */
export function createGenerationChargeGate(chargeFn: () => void | Promise<void>) {
  let pending = false;

  return {
    arm(): void {
      pending = true;
    },

    /** Cancels an armed charge without firing chargeFn — e.g. the request never actually went out. */
    disarm(): void {
      pending = false;
    },

    onFinish(outcome: { isAbort: boolean; isError: boolean }): void {
      if (!pending) {
        return;
      }

      pending = false;

      if (!outcome.isAbort && !outcome.isError) {
        void chargeFn();
      }
    },
  };
}
