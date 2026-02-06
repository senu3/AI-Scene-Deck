import styles from './ReadOnlyValue.module.css';

export interface ReadOnlyValueProps {
  value: string;
  className?: string;
}

export function ReadOnlyValue({ value, className = '' }: ReadOnlyValueProps) {
  return <span className={`${styles.readOnlyValue} ${className}`}>{value}</span>;
}
