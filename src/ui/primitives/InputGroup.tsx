import { Input, type InputProps } from './Input';
import styles from './InputGroup.module.css';

export interface InputGroupProps extends InputProps {
  unit?: string;
}

export function InputGroup({ unit, className = '', ...props }: InputGroupProps) {
  return (
    <div className={`${styles.inputGroup} ${className}`}>
      <Input {...props} />
      {unit && <span className={styles.inputUnit}>{unit}</span>}
    </div>
  );
}
