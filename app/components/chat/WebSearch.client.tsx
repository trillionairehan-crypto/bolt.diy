import { useState, useRef, useEffect } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';

interface WebSearchProps {
  onSearchResult: (result: string) => void;
  disabled?: boolean;
  showLabel?: boolean;
}

interface WebSearchData {
  title: string;
  description: string;
  content: string;
  sourceUrl: string;
}

interface WebSearchResponse {
  success: boolean;
  data?: WebSearchData;
  error?: string;
}

function formatSearchResult(data: WebSearchData): string {
  const parts: string[] = [`[Web content from ${data.sourceUrl}]`];

  if (data.title) {
    parts.push(`Title: ${data.title}`);
  }

  if (data.description) {
    parts.push(`Description: ${data.description}`);
  }

  parts.push('', data.content);

  return parts.join('\n');
}

export function WebSearch({ onSearchResult, disabled = false, showLabel = true }: WebSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleFetch = async () => {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch('/api/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const result = (await response.json()) as WebSearchResponse;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || '웹페이지 내용을 가져오지 못했어요');
      }

      onSearchResult(formatSearchResult(result.data));
      toast.success('웹페이지 내용을 가져왔어요');
      setUrl('');
      setIsOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '주소를 가져오지 못했어요');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        title="참고할 사이트 주소 넣기"
        disabled={disabled || isSearching}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center h-8 gap-1.5 px-2 shrink-0 whitespace-nowrap !text-bolt-elements-textSecondary"
      >
        {isSearching ? (
          <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-base animate-spin" />
        ) : (
          <div className="i-ph:link text-base" />
        )}
        <span className={classNames('text-[13px]', showLabel ? 'hidden sm:inline' : 'hidden')}>사이트</span>
      </IconButton>
      {isOpen && (
        <div
          className={classNames(
            'absolute bottom-full left-0 mb-2 flex items-center gap-2 max-w-[calc(100vw-2rem)]',
            'rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-2 shadow-lg',
          )}
        >
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isSearching) {
                handleFetch();
              }

              if (e.key === 'Escape') {
                setIsOpen(false);
              }
            }}
            placeholder="https://example.com"
            disabled={isSearching}
            className={classNames(
              'w-[min(300px,calc(100vw-8rem))] px-3 py-1.5 text-sm rounded-md',
              'border border-bolt-elements-borderColor',
              'bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary',
              'placeholder-bolt-elements-textTertiary',
              'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus',
            )}
          />
          <button
            onClick={handleFetch}
            disabled={isSearching || !url.trim()}
            className={classNames(
              'px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap',
              'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text',
              'hover:bg-bolt-elements-button-primary-backgroundHover',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSearching ? '가져오는 중...' : '가져오기'}
          </button>
        </div>
      )}
    </div>
  );
}
