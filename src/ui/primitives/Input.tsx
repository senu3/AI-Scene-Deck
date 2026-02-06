import { forwardRef, type InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ size = 'md', className = '', ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`${styles.input} ${className}`}
        data-size={size === 'md' ? undefined : size}
        {...props}
      />
    );
  }
);
