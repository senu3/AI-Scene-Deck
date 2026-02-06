import { useCallback, type ReactNode } from 'react';
import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className = '',
}: ToggleProps) {
  const handleClick = useCallback(() => {
    if (!disabled) {
      onChange(!checked);
    }
  }, [checked, disabled, onChange]);

  return (
    <div
      className={`${styles.toggleWrapper} ${className}`}
      data-disabled={disabled}
      onClick={handleClick}
    >
      <div className={styles.toggleTrack} data-checked={checked} data-size={size}>
        <div className={styles.toggleThumb} />
      </div>
      {(label || description) && (
        <div className={styles.toggleText}>
          {label && <span className={styles.toggleLabel}>{label}</span>}
          {description && <span className={styles.toggleDescription}>{description}</span>}
        </div>
      )}
    </div>
  );
}
