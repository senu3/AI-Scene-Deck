import { type HTMLAttributes, type ReactNode } from 'react';
import styles from './SettingsRow.module.css';

export interface SettingsRowProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
  labelWrapperClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
  controlsClassName?: string;
}

export function SettingsRow({
  label,
  description,
  children,
  className = '',
  labelWrapperClassName,
  labelClassName,
  descriptionClassName,
  controlsClassName,
  ...rest
}: SettingsRowProps) {
  const rootClassName = className || styles.settingsRow;
  const labelWrapper = labelWrapperClassName ?? styles.settingsRowLabel;
  const labelText = labelClassName ?? styles.settingsRowLabelText;
  const descriptionText = descriptionClassName ?? styles.settingsRowDesc;
  const controls = controlsClassName ?? styles.settingsRowControl;

  return (
    <div className={rootClassName} {...rest}>
      <div className={labelWrapper}>
        <span className={labelText}>{label}</span>
        {description && <span className={descriptionText}>{description}</span>}
      </div>
      <div className={controls}>{children}</div>
    </div>
  );
}
