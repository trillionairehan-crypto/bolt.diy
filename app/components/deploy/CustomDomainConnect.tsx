import { useEffect, useRef, useState } from 'react';

/**
 * TODO(티어 분기): no server-side subscription/tier lookup exists anywhere in this codebase yet
 * (see cloudflarePages.ts's own Made-with-badge TODO for the same gap). Locked-by-default is the
 * safer failure mode for a paid feature than shipping it wide-open while that's pending — flip this
 * to a real per-user check once one exists, rather than adding a fake one here.
 */
const TODO_IS_PRO_USER = false;

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 60; // ~5 minutes

interface CustomDomainConnectProps {
  projectName: string;
}

type ConnectState = 'idle' | 'connecting' | 'pending' | 'active' | 'error';

export function CustomDomainConnect({ projectName }: CustomDomainConnectProps) {
  const [domain, setDomain] = useState('');
  const [state, setState] = useState<ConnectState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollCountRef = useRef(0);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  const pollStatus = (connectedDomain: string) => {
    pollTimeoutRef.current = setTimeout(async () => {
      pollCountRef.current += 1;

      try {
        const response = await fetch(
          `/api/cloudflare-domain?projectName=${encodeURIComponent(projectName)}&domain=${encodeURIComponent(connectedDomain)}`,
        );
        const data = (await response.json()) as { success?: boolean; status?: string; error?: string };

        if (!response.ok || !data.success) {
          setState('error');
          setErrorMessage(data.error || '상태 확인에 실패했어요.');

          return;
        }

        if (data.status === 'active') {
          setState('active');
          return;
        }

        if (pollCountRef.current >= MAX_POLLS) {
          // Not an error — DNS propagation can take a while. Stop polling; the user can re-check later.
          return;
        }

        pollStatus(connectedDomain);
      } catch {
        setState('error');
        setErrorMessage('상태 확인에 실패했어요.');
      }
    }, POLL_INTERVAL_MS);
  };

  const handleConnect = async () => {
    const trimmed = domain.trim().toLowerCase();

    if (!trimmed) {
      return;
    }

    setState('connecting');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/cloudflare-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, domain: trimmed }),
      });

      const data = (await response.json()) as { success?: boolean; status?: string; error?: string };

      if (!response.ok || !data.success) {
        setState('error');
        setErrorMessage(data.error || '도메인 연결에 실패했어요.');

        return;
      }

      if (data.status === 'active') {
        setState('active');
        return;
      }

      setState('pending');
      pollCountRef.current = 0;
      pollStatus(trimmed);
    } catch {
      setState('error');
      setErrorMessage('도메인 연결에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  };

  if (!TODO_IS_PRO_USER) {
    return (
      <div className="cr-card cr-stack-8" style={{ maxWidth: 420 }}>
        <p className="cr-body">커스텀 도메인 연결은 Pro 요금제에서 사용할 수 있어요.</p>
        <a href="/pricing" className="cr-btn outline" style={{ width: 'fit-content' }}>
          요금제 보기
        </a>
      </div>
    );
  }

  return (
    <div className="cr-card cr-stack-8" style={{ maxWidth: 420 }}>
      <p className="cr-body">내 도메인 연결하기</p>

      {state !== 'active' && (
        <div className="cr-row-8">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="myapp.com"
            disabled={state === 'connecting' || state === 'pending'}
            className="cr-input"
          />
          <button
            type="button"
            onClick={handleConnect}
            disabled={!domain.trim() || state === 'connecting' || state === 'pending'}
            className="cr-btn"
          >
            {state === 'connecting' ? '연결 중...' : '연결하기'}
          </button>
        </div>
      )}

      {state === 'pending' && (
        <>
          <p className="cr-caption">도메인 상태를 확인하고 있어요 (대기 중)...</p>
          <p className="cr-caption">
            도메인을 다른 곳에서 등록했다면, 등록기관의 DNS 설정에서 CNAME 레코드를 추가해주세요:{' '}
            <span className="cr-mono">
              {domain || '도메인'} → {projectName}.pages.dev
            </span>
          </p>
        </>
      )}

      {state === 'active' && <p className="cr-caption">도메인이 연결됐어요 (활성).</p>}

      {state === 'error' && errorMessage && <p className="cr-caption">{errorMessage}</p>}
    </div>
  );
}
