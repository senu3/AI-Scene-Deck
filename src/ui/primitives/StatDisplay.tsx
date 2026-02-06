import styles from './StatDisplay.module.css';

export interface StatDisplayProps {
  label: string;
  value: string | number;
  unit?: string;
  className?: string;
}

export function StatDisplay({ label, value, unit, className = '' }: StatDisplayProps) {
  return (
    <div className={`${styles.statDisplay} ${className}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>
        {value}
        {unit && <span className={styles.statUnit}>{unit}</span>}
      </span>
    </div>
  );
}
