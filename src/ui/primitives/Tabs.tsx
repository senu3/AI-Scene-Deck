import { type ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  className = '',
}: TabsProps) {
  return (
    <div className={`${styles.tabs} ${className}`} data-variant={variant} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={styles.tabItem}
          data-active={activeTab === tab.id}
          disabled={tab.disabled}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span className={styles.tabIcon}>{tab.icon}</span>}
          <span className={styles.tabLabel}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
