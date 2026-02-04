/**
 * Form Controls - Input, Select, Radio, Checkbox primitives
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  type ReactNode,
  type ChangeEvent,
  type InputHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './FormControls.module.css';

// ============================================
// Input
// ============================================
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

// ============================================
// InputGroup - Input with unit suffix
// ============================================
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

// ============================================
// Select
// ============================================
export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setOpen(false);
    },
    [onChange]
  );

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on escape
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <div ref={containerRef} className={`${styles.selectContainer} ${className}`}>
      <button
        type="button"
        className={styles.selectTrigger}
        data-open={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.selectValue}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown size={14} className={styles.selectIcon} />
      </button>

      {open && (
        <div className={styles.selectDropdown}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.selectOption}
              data-selected={option.value === value}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Radio Group
// ============================================
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

// ============================================
// Checkbox
// ============================================
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

// ============================================
// Field - Label + input wrapper
// ============================================
export interface FieldProps {
  label: string;
  hint?: string;
  inline?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  hint,
  inline = false,
  children,
  className = '',
}: FieldProps) {
  return (
    <div className={`${inline ? styles.fieldInline : styles.field} ${className}`}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </div>
  );
}

// ============================================
// ReadOnlyValue - Display-only value
// ============================================
export interface ReadOnlyValueProps {
  value: string;
  className?: string;
}

export function ReadOnlyValue({ value, className = '' }: ReadOnlyValueProps) {
  return <span className={`${styles.readOnlyValue} ${className}`}>{value}</span>;
}

// ============================================
// PathField - Path display with change button
// ============================================
export interface PathFieldProps {
  value: string;
  onChangePath?: () => void;
  changeLabel?: string;
  className?: string;
}

export function PathField({
  value,
  onChangePath,
  changeLabel = 'Change',
  className = '',
}: PathFieldProps) {
  return (
    <div className={`${styles.pathField} ${className}`}>
      <span className={styles.pathValue} title={value}>
        {value}
      </span>
      {onChangePath && (
        <button
          type="button"
          className={styles.pathButton}
          onClick={onChangePath}
        >
          {changeLabel}
        </button>
      )}
    </div>
  );
}

// ============================================
// Toggle / Switch
// ============================================
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

// ============================================
// Tabs
// ============================================
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

// ============================================
// SettingsSection - Group related settings
// ============================================
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

// ============================================
// SettingsRow - Single setting row
// ============================================
export interface SettingsRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsRow({
  label,
  description,
  children,
  className = '',
}: SettingsRowProps) {
  return (
    <div className={`${styles.settingsRow} ${className}`}>
      <div className={styles.settingsRowLabel}>
        <span className={styles.settingsRowLabelText}>{label}</span>
        {description && <span className={styles.settingsRowDesc}>{description}</span>}
      </div>
      <div className={styles.settingsRowControl}>{children}</div>
    </div>
  );
}

// ============================================
// StatDisplay - Show statistics
// ============================================
export interface StatDisplayProps {
  label: string;
  value: string | number;
  unit?: string;
  className?: string;
}

export function StatDisplay({ label, value, unit, className = '' }: StatDisplayProps) {
  return (
    <div className={`${styles.statDisplay} ${className}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>
        {value}
        {unit && <span className={styles.statUnit}>{unit}</span>}
      </span>
    </div>
  );
}

// ============================================
// Convenience export
// ============================================
export const FormControls = {
  Input,
  InputGroup,
  Select,
  RadioGroup,
  Checkbox,
  Field,
  ReadOnlyValue,
  PathField,
  Toggle,
  Tabs,
  SettingsSection,
  SettingsRow,
  StatDisplay,
};

export default FormControls;
