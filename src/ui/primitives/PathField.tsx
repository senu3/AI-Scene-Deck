import styles from './PathField.module.css';

export interface PathFieldProps {
  value: string;
  onChangePath?: () => void;
  changeLabel?: string;
  className?: string;
}

export function PathField({
  value,
  onChangePath,
  changeLabel = 'Change',
  className = '',
}: PathFieldProps) {
  return (
    <div className={`${styles.pathField} ${className}`}>
      <span className={styles.pathValue} title={value}>
        {value}
      </span>
      {onChangePath && (
        <button
          type="button"
          className={styles.pathButton}
          onClick={onChangePath}
        >
          {changeLabel}
        </button>
      )}
    </div>
  );
}
