import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { ScreenshotSelector } from './ScreenshotSelector';
import type { ElementInfo } from './Inspector';
import {
  LOCAL_PREVIEW_SERVER_URL,
  LOCAL_PREVIEW_SESSION_ID,
  LOCAL_PREVIEW_STORAGE_KEY,
  postFileToLocalPreviewServer,
} from '~/lib/stores/previews';
import { path } from '~/utils/path';
import { WORK_DIR } from '~/utils/constants';
import { Skeleton } from '~/components/ui/Skeleton';

type ResizeSide = 'left' | 'right' | null;

interface PreviewProps {
  setSelectedElement?: (element: ElementInfo | null) => void;
}

interface WindowSize {
  name: string;
  width: number;
  height: number;
  icon: string;
  hasFrame?: boolean;
  frameType?: 'mobile' | 'tablet' | 'laptop' | 'desktop';
}

const WINDOW_SIZES: WindowSize[] = [
  { name: 'iPhone SE', width: 375, height: 667, icon: 'i-ph:device-mobile', hasFrame: true, frameType: 'mobile' },
  { name: 'iPhone 12/13', width: 390, height: 844, icon: 'i-ph:device-mobile', hasFrame: true, frameType: 'mobile' },
  {
    name: 'iPhone 12/13 Pro Max',
    width: 428,
    height: 926,
    icon: 'i-ph:device-mobile',
    hasFrame: true,
    frameType: 'mobile',
  },
  { name: 'iPad Mini', width: 768, height: 1024, icon: 'i-ph:device-tablet', hasFrame: true, frameType: 'tablet' },
  { name: 'iPad Air', width: 820, height: 1180, icon: 'i-ph:device-tablet', hasFrame: true, frameType: 'tablet' },
  { name: 'iPad Pro 11"', width: 834, height: 1194, icon: 'i-ph:device-tablet', hasFrame: true, frameType: 'tablet' },
  {
    name: 'iPad Pro 12.9"',
    width: 1024,
    height: 1366,
    icon: 'i-ph:device-tablet',
    hasFrame: true,
    frameType: 'tablet',
  },
  { name: 'Small Laptop', width: 1280, height: 800, icon: 'i-ph:laptop', hasFrame: true, frameType: 'laptop' },
  { name: 'Laptop', width: 1366, height: 768, icon: 'i-ph:laptop', hasFrame: true, frameType: 'laptop' },
  { name: 'Large Laptop', width: 1440, height: 900, icon: 'i-ph:laptop', hasFrame: true, frameType: 'laptop' },
  { name: 'Desktop', width: 1920, height: 1080, icon: 'i-ph:monitor', hasFrame: true, frameType: 'desktop' },
  { name: '4K Display', width: 3840, height: 2160, icon: 'i-ph:monitor', hasFrame: true, frameType: 'desktop' },
];

/*
 * 생성물 자동 검토 2단계 — "뷰포트 첫 화면"을 실제 데스크톱처럼 담아내려면 캡처 순간만 이 크기로
 * 리사이즈해야 한다(축소된 좁은 레이아웃을 다시 늘려서 찍으면 반응형 브레이크포인트 자체가 달라짐).
 */
const SCREENSHOT_CAPTURE_WIDTH = 1280;
const SCREENSHOT_CAPTURE_HEIGHT = 800;
const SCREENSHOT_CAPTURE_TIMEOUT_MS = 5000;

export const Preview = memo(({ setSelectedElement }: PreviewProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingScreenshotRequestsRef = useRef(
    new Map<string, (result: { dataUrl: string } | { error: string }) => void>(),
  );
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const hasSelectedPreview = useRef(false);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const [, setDisplayPath] = useState('/');
  const [iframeUrl, setIframeUrl] = useState<string | undefined>();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isInspectorMode, setIsInspectorMode] = useState(false);
  const [isDeviceModeOn] = useState(false);
  const [widthPercent, setWidthPercent] = useState<number>(37.5);
  const [currentWidth, setCurrentWidth] = useState<number>(0);

  const resizingState = useRef({
    isResizing: false,
    side: null as ResizeSide,
    startX: 0,
    startWidthPercent: 37.5,
    windowWidth: window.innerWidth,
    pointerId: null as number | null,
  });

  // Reduce scaling factor to make resizing less sensitive
  const SCALING_FACTOR = 1;

  const [selectedWindowSize] = useState<WindowSize>(WINDOW_SIZES[0]);
  const [isLandscape] = useState(false);
  const [showDeviceFrameInPreview, setShowDeviceFrameInPreview] = useState(false);
  const [useLocalPreviewServer, setUseLocalPreviewServer] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return localStorage.getItem(LOCAL_PREVIEW_STORAGE_KEY) === 'true';
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the hidden toggle button, see comment near the toolbar
  const toggleLocalPreviewServer = useCallback(() => {
    setUseLocalPreviewServer((prev) => {
      const next = !prev;
      localStorage.setItem(LOCAL_PREVIEW_STORAGE_KEY, String(next));

      if (next) {
        /*
         * Push whatever is already loaded right away, so there's something to see
         * immediately instead of waiting for the next file-write action to mirror it.
         */
        const files = workbenchStore.files.get();

        Object.entries(files).forEach(([filePath, dirent]) => {
          if (dirent?.type !== 'file' || dirent.isBinary) {
            return;
          }

          const relativePath = path.relative(WORK_DIR, filePath);

          postFileToLocalPreviewServer(relativePath, dirent.content).catch((error) => {
            console.warn('[Preview] Failed to sync file to local preview server:', filePath, error);
          });
        });
      }

      return next;
    });
  }, []);

  useEffect(() => {
    if (useLocalPreviewServer) {
      setIframeUrl(`${LOCAL_PREVIEW_SERVER_URL}/preview/${LOCAL_PREVIEW_SESSION_ID}/`);
      setDisplayPath('/');

      return;
    }

    if (!activePreview) {
      setIframeUrl(undefined);
      setDisplayPath('/');

      return;
    }

    const { baseUrl } = activePreview;
    setIframeUrl(baseUrl);
    setDisplayPath('/');
  }, [activePreview, useLocalPreviewServer]);

  const findMinPortIndex = useCallback(
    (minIndex: number, preview: { port: number }, index: number, array: { port: number }[]) => {
      return preview.port < array[minIndex].port ? index : minIndex;
    },
    [],
  );

  useEffect(() => {
    if (previews.length > 1 && !hasSelectedPreview.current) {
      const minPortIndex = previews.reduce(findMinPortIndex, 0);
      setActivePreviewIndex(minPortIndex);
    }
  }, [previews, findMinPortIndex]);

  const startResizing = (e: React.PointerEvent, side: ResizeSide) => {
    if (!isDeviceModeOn) {
      return;
    }

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    resizingState.current = {
      isResizing: true,
      side,
      startX: e.clientX,
      startWidthPercent: widthPercent,
      windowWidth: window.innerWidth,
      pointerId: e.pointerId,
    };
  };

  const ResizeHandle = ({ side }: { side: ResizeSide }) => {
    if (!side) {
      return null;
    }

    return (
      <div
        className={`resize-handle-${side}`}
        onPointerDown={(e) => startResizing(e, side)}
        style={{
          position: 'absolute',
          top: 0,
          ...(side === 'left' ? { left: 0, marginLeft: '-7px' } : { right: 0, marginRight: '-7px' }),
          width: '15px',
          height: '100%',
          cursor: 'ew-resize',
          background: 'var(--bolt-elements-background-depth-4, rgba(0,0,0,.3))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s',
          userSelect: 'none',
          touchAction: 'none',
          zIndex: 10,
        }}
        onMouseOver={(e) =>
          (e.currentTarget.style.background = 'var(--bolt-elements-background-depth-4, rgba(0,0,0,.3))')
        }
        onMouseOut={(e) =>
          (e.currentTarget.style.background = 'var(--bolt-elements-background-depth-3, rgba(0,0,0,.15))')
        }
        title="드래그해서 너비 조절"
      >
        <GripIcon />
      </div>
    );
  };

  useEffect(() => {
    // Skip if not in device mode
    if (!isDeviceModeOn) {
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      const state = resizingState.current;

      if (!state.isResizing || e.pointerId !== state.pointerId) {
        return;
      }

      const dx = e.clientX - state.startX;
      const dxPercent = (dx / state.windowWidth) * 100 * SCALING_FACTOR;

      let newWidthPercent = state.startWidthPercent;

      if (state.side === 'right') {
        newWidthPercent = state.startWidthPercent + dxPercent;
      } else if (state.side === 'left') {
        newWidthPercent = state.startWidthPercent - dxPercent;
      }

      // Limit width percentage between 10% and 90%
      newWidthPercent = Math.max(10, Math.min(newWidthPercent, 90));

      // Force a synchronous update to ensure the UI reflects the change immediately
      setWidthPercent(newWidthPercent);

      // Calculate and update the actual pixel width
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const newWidth = Math.round((containerWidth * newWidthPercent) / 100);
        setCurrentWidth(newWidth);

        // Apply the width directly to the container for immediate feedback
        const previewContainer = containerRef.current.querySelector('div[style*="width"]');

        if (previewContainer) {
          (previewContainer as HTMLElement).style.width = `${newWidthPercent}%`;
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const state = resizingState.current;

      if (!state.isResizing || e.pointerId !== state.pointerId) {
        return;
      }

      // Find all resize handles
      const handles = document.querySelectorAll('.resize-handle-left, .resize-handle-right');

      // Release pointer capture from any handle that has it
      handles.forEach((handle) => {
        if ((handle as HTMLElement).hasPointerCapture?.(e.pointerId)) {
          (handle as HTMLElement).releasePointerCapture(e.pointerId);
        }
      });

      // Reset state
      resizingState.current = {
        ...resizingState.current,
        isResizing: false,
        side: null,
        pointerId: null,
      };

      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    // Add event listeners
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);

    // Define cleanup function
    function cleanupResizeListeners() {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);

      // Release any lingering pointer captures
      if (resizingState.current.pointerId !== null) {
        const handles = document.querySelectorAll('.resize-handle-left, .resize-handle-right');
        handles.forEach((handle) => {
          if ((handle as HTMLElement).hasPointerCapture?.(resizingState.current.pointerId!)) {
            (handle as HTMLElement).releasePointerCapture(resizingState.current.pointerId!);
          }
        });

        // Reset state
        resizingState.current = {
          ...resizingState.current,
          isResizing: false,
          side: null,
          pointerId: null,
        };

        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    }

    // Return the cleanup function
    // eslint-disable-next-line consistent-return
    return cleanupResizeListeners;
  }, [isDeviceModeOn, SCALING_FACTOR]);

  useEffect(() => {
    const handleWindowResize = () => {
      // Update the window width in the resizing state
      resizingState.current.windowWidth = window.innerWidth;

      // Update the current width in pixels
      if (containerRef.current && isDeviceModeOn) {
        const containerWidth = containerRef.current.clientWidth;
        setCurrentWidth(Math.round((containerWidth * widthPercent) / 100));
      }
    };

    window.addEventListener('resize', handleWindowResize);

    // Initial calculation of current width
    if (containerRef.current && isDeviceModeOn) {
      const containerWidth = containerRef.current.clientWidth;
      setCurrentWidth(Math.round((containerWidth * widthPercent) / 100));
    }

    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [isDeviceModeOn, widthPercent]);

  // Update current width when device mode is toggled
  useEffect(() => {
    if (containerRef.current && isDeviceModeOn) {
      const containerWidth = containerRef.current.clientWidth;
      setCurrentWidth(Math.round((containerWidth * widthPercent) / 100));
    }
  }, [isDeviceModeOn]);

  const GripIcon = () => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          color: 'var(--bolt-elements-textSecondary, rgba(0,0,0,0.5))',
          fontSize: '10px',
          lineHeight: '5px',
          userSelect: 'none',
          marginLeft: '1px',
        }}
      >
        ••• •••
      </div>
    </div>
  );

  // Function to get the correct frame padding based on orientation
  const getFramePadding = useCallback(() => {
    if (!selectedWindowSize) {
      return '40px 20px';
    }

    const isMobile = selectedWindowSize.frameType === 'mobile';

    if (isLandscape) {
      // Increase horizontal padding in landscape mode to ensure full device frame is visible
      return isMobile ? '40px 60px' : '30px 50px';
    }

    return isMobile ? '40px 20px' : '50px 30px';
  }, [isLandscape, selectedWindowSize]);

  // Function to get the scale factor for the device frame
  const getDeviceScale = useCallback(() => {
    // Always return 1 to ensure the device frame is shown at its exact size
    return 1;
  }, [isLandscape, selectedWindowSize, widthPercent]);

  // Update the device scale when needed
  useEffect(() => {
    /*
     * Intentionally disabled - we want to maintain scale of 1
     * No dynamic scaling to ensure device frame matches external window exactly
     */
    // Intentionally empty cleanup function - no cleanup needed
    return () => {
      // No cleanup needed
    };
  }, [isDeviceModeOn, showDeviceFrameInPreview, getDeviceScale, isLandscape, selectedWindowSize]);

  // Function to get the frame color based on dark mode
  const getFrameColor = useCallback(() => {
    // Check if the document has a dark class or data-theme="dark"
    const isDarkMode =
      document.documentElement.classList.contains('dark') ||
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Return a darker color for light mode, lighter color for dark mode
    return isDarkMode ? '#555' : '#111';
  }, []);

  // Effect to handle color scheme changes
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleColorSchemeChange = () => {
      // Force a re-render when color scheme changes
      if (showDeviceFrameInPreview) {
        setShowDeviceFrameInPreview(true);
      }
    };

    darkModeMediaQuery.addEventListener('change', handleColorSchemeChange);

    return () => {
      darkModeMediaQuery.removeEventListener('change', handleColorSchemeChange);
    };
  }, [showDeviceFrameInPreview]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'INSPECTOR_READY') {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              type: 'INSPECTOR_ACTIVATE',
              active: isInspectorMode,
            },
            '*',
          );
        }
      } else if (event.data.type === 'INSPECTOR_CLICK') {
        const element = event.data.elementInfo;

        navigator.clipboard.writeText(element.displayText).then(() => {
          setSelectedElement?.(element);
        });

        // One click = one selection — turn the picker off so a stray second click can't replace it.
        setIsInspectorMode(false);

        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'INSPECTOR_ACTIVATE', active: false }, '*');
        }
      } else if (event.data.type === 'VITE_COMPILE_ERROR') {
        /*
         * Reuses the same actionAlert(source:'preview') pipeline that runtime errors already
         * feed into — Chat.client.tsx's auto-fix effect doesn't need to know where this came from.
         * setPreviewAlert (not actionAlert.set directly) debounces against
         * checkArtifactFileReferences catching the exact same problem moments earlier.
         */
        workbenchStore.setPreviewAlert({
          type: 'preview',
          title: 'Compile Error',
          description: typeof event.data.message === 'string' ? event.data.message : 'Vite compile error',
          content: typeof event.data.stack === 'string' ? event.data.stack : '',
          source: 'preview',
        });
      } else if (event.data.type === 'VITE_COMPILE_OK') {
        setHasRenderedOnce(true);
      } else if (event.data.type === 'SCREENSHOT_CAPTURED' || event.data.type === 'SCREENSHOT_FAILED') {
        const resolver = pendingScreenshotRequestsRef.current.get(event.data.requestId);

        if (resolver) {
          pendingScreenshotRequestsRef.current.delete(event.data.requestId);
          resolver(
            event.data.type === 'SCREENSHOT_CAPTURED' ? { dataUrl: event.data.dataUrl } : { error: event.data.reason },
          );
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => window.removeEventListener('message', handleMessage);
  }, [isInspectorMode]);

  /*
   * 생성물 자동 검토 2단계 — reviewGeneratedApp.ts(React 바깥)가 workbenchStore를 통해 호출할 수
   * 있게 등록해두는 진입점. iframe을 캡처 순간만 1280x800으로 리사이즈했다가 원래대로 되돌린다 —
   * 사용자가 지금 미리보기 패널을 보고 있다면 짧은 리사이즈가 보일 수 있지만("마무리하고 있어요"
   * 인디케이터가 이미 뜬 상태라 맥락 없는 변화는 아님), inspector-script.js 쪽에서 iframe 안의
   * html-to-image 캡처가 끝나는 즉시 원상복구한다.
   */
  const requestPreviewScreenshotImpl = useCallback((): Promise<string | null> => {
    const iframe = iframeRef.current;

    if (!iframe || !iframe.contentWindow) {
      return Promise.resolve(null);
    }

    const requestId = `shot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const originalWidth = iframe.style.width;
    const originalHeight = iframe.style.height;

    const restore = () => {
      iframe.style.width = originalWidth;
      iframe.style.height = originalHeight;
    };

    iframe.style.width = `${SCREENSHOT_CAPTURE_WIDTH}px`;
    iframe.style.height = `${SCREENSHOT_CAPTURE_HEIGHT}px`;

    return new Promise<string | null>((resolve) => {
      let settled = false;

      const finish = (value: string | null) => {
        if (settled) {
          return;
        }

        settled = true;
        pendingScreenshotRequestsRef.current.delete(requestId);
        restore();
        resolve(value);
      };

      const timeoutId = setTimeout(() => finish(null), SCREENSHOT_CAPTURE_TIMEOUT_MS);

      pendingScreenshotRequestsRef.current.set(requestId, (result) => {
        clearTimeout(timeoutId);
        finish('dataUrl' in result ? result.dataUrl : null);
      });

      /*
       * Give the resize a moment to actually reflow inside the (cross-origin, independently
       * rendered) iframe before asking it to capture — otherwise the capture can race the resize.
       */
      setTimeout(() => {
        iframe.contentWindow?.postMessage({ type: 'CAPTURE_SCREENSHOT', requestId }, '*');
      }, 100);
    });
  }, []);

  useEffect(() => {
    workbenchStore.registerPreviewScreenshotRequester(requestPreviewScreenshotImpl);

    return () => workbenchStore.registerPreviewScreenshotRequester(null);
  }, [requestPreviewScreenshotImpl]);

  /*
   * Gates the preview iframe behind a loading state until the very first successful compile —
   * once true, this never resets, so a later compile error never takes away a screen the user
   * already saw. See VITE_COMPILE_OK/VITE_COMPILE_ERROR handling above and the timeout fallback below.
   */
  const [hasRenderedOnce, setHasRenderedOnce] = useState(false);

  useEffect(() => {
    if (!iframeUrl || hasRenderedOnce) {
      return undefined;
    }

    /*
     * Vite gives no explicit "nothing is wrong" signal, and the overlay/#root detection in
     * inspector-script.js can miss edge cases — this is the hard ceiling that guarantees the
     * preview is never stuck behind the loading state indefinitely.
     */
    const timeoutId = setTimeout(() => {
      setHasRenderedOnce(true);
    }, 15000);

    return () => clearTimeout(timeoutId);
  }, [iframeUrl, hasRenderedOnce]);

  /*
   * 채팅 홈·생성 전환 통합 수정 — hasRenderedOnce는 이 컴포넌트 로컬 상태라 바깥(데스크톱 2단
   * 전환/모바일 탭 표시)에서 볼 수 없다. workbenchStore.previewReady로 그대로 미러링해서, 이
   * 컴포넌트가 데스크톱처럼 상시 마운트돼 있든(폭 0으로 접힘) 모바일처럼 숨겨진 채 마운트돼
   * 있든(className="hidden") 똑같이 "첫 렌더 가능 시점" 신호를 밖으로 흘려보낸다.
   */
  useEffect(() => {
    if (hasRenderedOnce) {
      workbenchStore.previewReady.set(true);
    }
  }, [hasRenderedOnce]);

  return (
    <div ref={containerRef} className={`w-full h-full flex flex-col relative`}>
      <div className="flex-1 border-t border-bolt-elements-borderColor flex justify-center items-center overflow-auto">
        <div
          style={{
            width: isDeviceModeOn ? (showDeviceFrameInPreview ? '100%' : `${widthPercent}%`) : '100%',
            height: '100%',
            overflow: 'auto',
            background: 'var(--bolt-elements-background-depth-1)',
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {activePreview ? (
            <>
              {isDeviceModeOn && showDeviceFrameInPreview ? (
                <div
                  className="device-wrapper"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    height: '100%',
                    padding: '0',
                    overflow: 'auto',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                  }}
                >
                  <div
                    className="device-frame-container"
                    style={{
                      position: 'relative',
                      borderRadius: selectedWindowSize.frameType === 'mobile' ? '36px' : '20px',
                      background: getFrameColor(),
                      padding: getFramePadding(),
                      boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                      overflow: 'hidden',
                      transform: 'scale(1)',
                      transformOrigin: 'center center',
                      transition: 'all 0.3s ease',
                      margin: '40px',
                      width: isLandscape
                        ? `${selectedWindowSize.height + (selectedWindowSize.frameType === 'mobile' ? 120 : 60)}px`
                        : `${selectedWindowSize.width + (selectedWindowSize.frameType === 'mobile' ? 40 : 60)}px`,
                      height: isLandscape
                        ? `${selectedWindowSize.width + (selectedWindowSize.frameType === 'mobile' ? 80 : 60)}px`
                        : `${selectedWindowSize.height + (selectedWindowSize.frameType === 'mobile' ? 80 : 100)}px`,
                    }}
                  >
                    {/* Notch - positioned based on orientation */}
                    <div
                      style={{
                        position: 'absolute',
                        top: isLandscape ? '50%' : '20px',
                        left: isLandscape ? '30px' : '50%',
                        transform: isLandscape ? 'translateY(-50%)' : 'translateX(-50%)',
                        width: isLandscape ? '8px' : selectedWindowSize.frameType === 'mobile' ? '60px' : '80px',
                        height: isLandscape ? (selectedWindowSize.frameType === 'mobile' ? '60px' : '80px') : '8px',
                        background: '#333',
                        borderRadius: '4px',
                        zIndex: 2,
                      }}
                    />

                    {/* Home button - positioned based on orientation */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: isLandscape ? '50%' : '15px',
                        right: isLandscape ? '30px' : '50%',
                        transform: isLandscape ? 'translateY(50%)' : 'translateX(50%)',
                        width: isLandscape ? '4px' : '40px',
                        height: isLandscape ? '40px' : '4px',
                        background: '#333',
                        borderRadius: '50%',
                        zIndex: 2,
                      }}
                    />

                    <iframe
                      ref={iframeRef}
                      title="preview"
                      style={{
                        border: 'none',
                        width: isLandscape ? `${selectedWindowSize.height}px` : `${selectedWindowSize.width}px`,
                        height: isLandscape ? `${selectedWindowSize.width}px` : `${selectedWindowSize.height}px`,
                        background: 'white',
                        display: 'block',
                      }}
                      src={iframeUrl}
                      sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
                      allow="cross-origin-isolated"
                    />
                  </div>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  title="preview"
                  className="border-none w-full h-full bg-bolt-elements-background-depth-1"
                  src={iframeUrl}
                  sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
                  allow="geolocation; ch-ua-full-version-list; cross-origin-isolated; screen-wake-lock; publickey-credentials-get; shared-storage-select-url; ch-ua-arch; bluetooth; compute-pressure; ch-prefers-reduced-transparency; deferred-fetch; usb; ch-save-data; publickey-credentials-create; shared-storage; deferred-fetch-minimal; run-ad-auction; ch-ua-form-factors; ch-downlink; otp-credentials; payment; ch-ua; ch-ua-model; ch-ect; autoplay; camera; private-state-token-issuance; accelerometer; ch-ua-platform-version; idle-detection; private-aggregation; interest-cohort; ch-viewport-height; local-fonts; ch-ua-platform; midi; ch-ua-full-version; xr-spatial-tracking; clipboard-read; gamepad; display-capture; keyboard-map; join-ad-interest-group; ch-width; ch-prefers-reduced-motion; browsing-topics; encrypted-media; gyroscope; serial; ch-rtt; ch-ua-mobile; window-management; unload; ch-dpr; ch-prefers-color-scheme; ch-ua-wow64; attribution-reporting; fullscreen; identity-credentials-get; private-state-token-redemption; hid; ch-ua-bitness; storage-access; sync-xhr; ch-device-memory; ch-viewport-width; picture-in-picture; magnetometer; clipboard-write; microphone"
                />
              )}
              <ScreenshotSelector
                isSelectionMode={isSelectionMode}
                setIsSelectionMode={setIsSelectionMode}
                containerRef={iframeRef}
              />
              {!useLocalPreviewServer && !hasRenderedOnce && (
                <div className="absolute inset-0 z-10 flex flex-col gap-3 p-6 bg-bolt-elements-background-depth-1">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <div
                      className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress"
                      style={{ fontSize: '1.5rem' }}
                    />
                    <p className="text-sm text-bolt-elements-textTertiary">코드를 확인하고 있어요</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex w-full h-full justify-center items-center bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary">
              미리볼 화면이 없어요
            </div>
          )}

          {isDeviceModeOn && !showDeviceFrameInPreview && (
            <>
              {/* Width indicator */}
              <div
                style={{
                  position: 'absolute',
                  top: '-25px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--bolt-elements-background-depth-3, rgba(0,0,0,0.7))',
                  color: 'var(--bolt-elements-textPrimary, white)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  pointerEvents: 'none',
                  opacity: resizingState.current.isResizing ? 1 : 0,
                  transition: 'opacity 0.3s',
                }}
              >
                {currentWidth}px
              </div>

              <ResizeHandle side="left" />
              <ResizeHandle side="right" />
            </>
          )}
        </div>
      </div>
    </div>
  );
});
