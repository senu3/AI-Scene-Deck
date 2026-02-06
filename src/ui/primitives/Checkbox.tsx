import { useCallback, type ChangeEvent, type ReactNode } from 'react';
import styles from './Checkbox.module.css';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
}: CheckboxProps) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.checked);
    },
    [onChange]
  );

  return (
    <label className={`${styles.checkboxItem} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className={styles.checkboxInput}
      />
      <span className={styles.checkboxBox} />
      {(label || description) && (
        <span>
          {label && <span className={styles.checkboxLabel}>{label}</span>}
          {description && (
            <span className={styles.checkboxDescription}>{description}</span>
          )}
        </span>
      )}
    </label>
  );
}
