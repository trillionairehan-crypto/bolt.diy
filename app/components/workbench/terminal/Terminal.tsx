import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as XTerm } from '@xterm/xterm';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import type { Theme } from '~/lib/stores/theme';
import { createScopedLogger } from '~/utils/logger';
import { getTerminalTheme } from './theme';

const logger = createScopedLogger('Terminal');

/*
 * Guard used before any operation that makes xterm re-measure/re-render (theme changes, fit()).
 * A terminal whose container is display:none (inactive tab) or has a collapsed 0-size ancestor
 * (workbench closed, terminal panel collapsed) reports 0 here — offsetWidth/Height are 0 for
 * both display:none elements and elements with a display:none/0-size ancestor, so this catches
 * every case that would otherwise crash xterm's RenderService.
 */
function isContainerVisible(element: HTMLDivElement | null): boolean {
  return !!element && element.offsetWidth > 0 && element.offsetHeight > 0;
}

export interface TerminalRef {
  reloadStyles: () => void;
  getTerminal: () => XTerm | undefined;
}

export interface TerminalProps {
  className?: string;
  theme: Theme;
  readonly?: boolean;
  id: string;
  onTerminalReady?: (terminal: XTerm) => void;
  onTerminalResize?: (cols: number, rows: number) => void;
}

export const Terminal = memo(
  forwardRef<TerminalRef, TerminalProps>(
    ({ className, theme, readonly, id, onTerminalReady, onTerminalResize }, ref) => {
      const terminalElementRef = useRef<HTMLDivElement>(null);
      const terminalRef = useRef<XTerm>();
      const fitAddonRef = useRef<FitAddon>();
      const resizeObserverRef = useRef<ResizeObserver>();
      const hasOpenedRef = useRef(false);

      useEffect(() => {
        const element = terminalElementRef.current!;

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();
        fitAddonRef.current = fitAddon;

        const terminal = new XTerm({
          cursorBlink: true,
          convertEol: true,
          disableStdin: readonly,
          theme: getTerminalTheme(readonly ? { cursor: '#00000000' } : {}),
          fontSize: 12,
          fontFamily: 'Menlo, courier-new, courier, monospace',
          allowProposedApi: true,
          scrollback: 1000,

          // Enable better clipboard handling
          rightClickSelectsWord: true,
        });

        terminalRef.current = terminal;
        hasOpenedRef.current = false;

        /*
         * loadAddon() doesn't touch the DOM (FitAddon/WebLinksAddon just stash the terminal
         * reference on activate()), so it's safe to run unconditionally here. open() is the one
         * that needs a real box to measure — deferred to the ResizeObserver below, which is also
         * why onTerminalReady still fires synchronously right after this: xterm queues writes
         * made before open() and flushes them once it does (confirmed against how attachTerminal
         * in lib/stores/terminal.ts uses it — it calls terminal.write() straight after attaching,
         * with no open-readiness check of its own), so callers piping shell output in don't need
         * to wait for the container to actually be visible.
         */
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);

        /*
         * Lazy-open: a terminal mounted while its container is zero-size — an inactive tab
         * (TerminalTabs.tsx mounts those `hidden` rather than not at all, to keep scrollback
         * alive) or one that mounts mid panel-open-animation — used to call open()/fit()
         * unconditionally at mount and crash xterm's RenderService ("Cannot read properties of
         * undefined (reading 'dimensions')"), because the renderer never got real metrics. This
         * single ResizeObserver now does double duty: its first non-zero callback opens the
         * terminal (once), and every non-zero callback after that (open or not) re-fits/notifies/
         * re-themes — exactly what the old "resize catches up a skipped theme change" comment
         * described, just also covering the very first paint now instead of only later resizes.
         * A zero-size callback (still hidden, or not visible yet) is always a no-op either way.
         */
        const resizeObserver = new ResizeObserver((entries) => {
          if (entries.length === 0) {
            return;
          }

          const { width, height } = entries[0].contentRect;

          if (width === 0 || height === 0) {
            return;
          }

          if (!hasOpenedRef.current) {
            try {
              terminal.open(element);
              hasOpenedRef.current = true;
            } catch (error) {
              logger.error(`Failed to initialize terminal [${id}]:`, error);

              // Attempt recovery
              setTimeout(() => {
                try {
                  terminal.open(element);
                  hasOpenedRef.current = true;
                  fitAddon.fit();
                } catch (retryError) {
                  logger.error(`Terminal recovery failed [${id}]:`, retryError);
                }
              }, 100);

              return;
            }
          }

          try {
            fitAddon.fit();
            onTerminalResize?.(terminal.cols, terminal.rows);
            terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
          } catch (error) {
            logger.error(`Resize error [${id}]:`, error);
          }
        });

        resizeObserverRef.current = resizeObserver;
        resizeObserver.observe(element);

        logger.debug(`Attach [${id}]`);

        onTerminalReady?.(terminal);

        return () => {
          try {
            resizeObserver.disconnect();
            terminal.dispose();
          } catch (error) {
            logger.error(`Cleanup error [${id}]:`, error);
          }
        };
      }, []);

      useEffect(() => {
        const terminal = terminalRef.current!;

        if (!isContainerVisible(terminalElementRef.current)) {
          return;
        }

        try {
          // we render a transparent cursor in case the terminal is readonly
          terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
          terminal.options.disableStdin = readonly;
        } catch (error) {
          logger.error(`Theme sync error [${id}]:`, error);
        }
      }, [theme, readonly]);

      useImperativeHandle(ref, () => {
        return {
          reloadStyles: () => {
            const terminal = terminalRef.current;

            if (!terminal || !isContainerVisible(terminalElementRef.current)) {
              return;
            }

            try {
              terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
            } catch (error) {
              logger.error(`reloadStyles error [${id}]:`, error);
            }
          },
          getTerminal: () => {
            return terminalRef.current;
          },
        };
      }, [readonly]);

      return <div className={className} ref={terminalElementRef} />;
    },
  ),
);
