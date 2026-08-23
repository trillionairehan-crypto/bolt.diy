import styles from './ScrollHint.module.scss';

/** Subtle bounce cue at the hero's bottom edge, inviting a scroll past the fold. */
export function ScrollHint() {
  return (
    <div className={styles.hint} aria-hidden="true">
      <div className={`${styles.chevron} i-ph:caret-down-bold`} />
    </div>
  );
}
