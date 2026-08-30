import { useEffect, useRef, useState } from 'react';
import styles from './AutoSaveField.module.scss';

interface AutoSaveFieldProps {
  value: string;
  onSave: (value: string) => void | Promise<void>;
  placeholder?: string;
}

type SaveStatus = 'idle' | 'saved' | 'error';

/**
 * 6: blur-triggered auto-save, no save button. Success shows "저장됨" for 1.5s (no toast);
 * failure shows a coral "저장하지 못했어요" + 다시 시도 that retries the same value. Typing is
 * never blocked while a save is in flight (6-4) — there's no visible "saving" state at all.
 */
export function AutoSaveField({ value, onSave, placeholder }: AutoSaveFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const lastSavedRef = useRef(value);

  useEffect(() => {
    setLocalValue(value);
    lastSavedRef.current = value;
  }, [value]);

  useEffect(() => {
    if (status !== 'saved') {
      return undefined;
    }

    const timer = setTimeout(() => setStatus('idle'), 1500);

    return () => clearTimeout(timer);
  }, [status]);

  const attemptSave = async (nextValue: string) => {
    try {
      await onSave(nextValue);
      lastSavedRef.current = nextValue;
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const handleBlur = () => {
    if (localValue === lastSavedRef.current) {
      return;
    }

    attemptSave(localValue);
  };

  return (
    <div className={styles.wrap}>
      {status === 'saved' && <span className={`${styles.status} ${styles.saved}`}>저장됨</span>}
      {status === 'error' && (
        <span className={`${styles.status} ${styles.error}`}>
          저장하지 못했어요{' '}
          <button type="button" className={styles.retry} onClick={() => attemptSave(localValue)}>
            다시 시도
          </button>
        </span>
      )}
      <input
        type="text"
        className={styles.input}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
      />
    </div>
  );
}
