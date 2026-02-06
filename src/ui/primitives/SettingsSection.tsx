import { type ReactNode } from 'react';
import styles from './SettingsSection.module.css';

export interface SettingsSectionProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  icon,
  children,
  className = '',
}: SettingsSectionProps) {
  return (
    <div className={`${styles.settingsSection} ${className}`}>
      {(title || description) && (
        <div className={styles.settingsSectionHeader}>
          {icon && <span className={styles.settingsSectionIcon}>{icon}</span>}
          <div className={styles.settingsSectionText}>
            {title && <h4 className={styles.settingsSectionTitle}>{title}</h4>}
            {description && <p className={styles.settingsSectionDesc}>{description}</p>}
          </div>
        </div>
      )}
      <div className={styles.settingsSectionContent}>{children}</div>
    </div>
  );
}
