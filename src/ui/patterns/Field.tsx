/**
 * Field - Label + hint + error wrapper for form inputs
 *
 * Usage:
 * <Field label="Name" hint="Enter your full name" error={errors.name}>
 *   <Input value={name} onChange={...} />
 * </Field>
 *
 * Note: This is in ui/patterns/ as it combines primitives for consistent form UX.
 */

import { type ReactNode } from 'react';
import styles from './Field.module.css';

// ============================================
// Types
// ============================================
export interface FieldProps {
  /** Field label */
  label: string;
  /** Help text shown below input */
  hint?: string;
  /** Error message (shown instead of hint when present) */
  error?: string;
  /** Required field indicator */
  required?: boolean;
  /** Inline layout (label and input on same row) */
  inline?: boolean;
  /** Form input element */
  children: ReactNode;
  /** Additional class name */
  className?: string;
}

// ============================================
// Field Component
// ============================================
export function Field({
  label,
  hint,
  error,
  required = false,
  inline = false,
  children,
  className = '',
}: FieldProps) {
  const hasError = Boolean(error);

  return (
    <div
      className={`${inline ? styles.fieldInline : styles.field} ${className}`}
      data-error={hasError || undefined}
    >
      <span className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.fieldRequired}>*</span>}
      </span>
      <div className={styles.fieldInput}>{children}</div>
      {(error || hint) && (
        <span className={hasError ? styles.fieldError : styles.fieldHint}>
          {error || hint}
        </span>
      )}
    </div>
  );
}

export default Field;
