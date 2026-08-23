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

        // Error handling for addon loading
        try {
          terminal.loadAddon(fitAddon);
          terminal.loadAddon(webLinksAddon);
          terminal.open(element);
        } catch (error) {
          logger.error(`Failed to initialize terminal [${id}]:`, error);

          // Attempt recovery
          setTimeout(() => {
            try {
              terminal.open(element);
              fitAddon.fit();
            } catch (retryError) {
              logger.error(`Terminal recovery failed [${id}]:`, retryError);
            }
          }, 100);
        }

        const resizeObserver = new ResizeObserver((entries) => {
          // Debounce resize events
          if (entries.length > 0) {
            const { width, height } = entries[0].contentRect;

            /*
             * A hidden/collapsed terminal container (display:none tab, or a resizable panel
             * collapsed to 0) reports a zero-size entry here. Calling fit() on it crashes xterm's
             * RenderService ("Cannot read properties of undefined (reading 'dimensions')") because
             * the renderer never got real metrics to work from — skip until it's actually visible.
             */
            if (width === 0 || height === 0) {
              return;
            }

            try {
              fitAddon.fit();
              onTerminalResize?.(terminal.cols, terminal.rows);

              /*
               * If a theme change was skipped earlier while this container was hidden (see the
               * theme-sync effect below), this is the first safe moment to catch it back up.
               */
              terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
            } catch (error) {
              logger.error(`Resize error [${id}]:`, error);
            }
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
