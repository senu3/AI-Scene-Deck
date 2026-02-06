import { useCallback, type ChangeEvent } from 'react';
import styles from './RadioGroup.module.css';

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  value: string;
  options: RadioOption[];
  onChange: (value: string) => void;
  direction?: 'vertical' | 'horizontal';
  className?: string;
}

export function RadioGroup({
  name,
  value,
  options,
  onChange,
  direction = 'vertical',
  className = '',
}: RadioGroupProps) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  return (
    <div
      className={`${styles.radioGroup} ${className}`}
      data-direction={direction}
      role="radiogroup"
    >
      {options.map((option) => (
        <label key={option.value} className={styles.radioItem}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={handleChange}
            disabled={option.disabled}
            className={styles.radioInput}
          />
          <span className={styles.radioCircle} />
          <span>
            <span className={styles.radioLabel}>{option.label}</span>
            {option.description && (
              <span className={styles.radioDescription}>{option.description}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
