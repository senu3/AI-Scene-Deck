/**
 * Slider - Horizontal range input with keyboard support
 *
 * Usage:
 * <Slider value={volume} min={0} max={100} onChange={setVolume} />
 * <Slider value={opacity} min={0} max={1} step={0.1} onChange={setOpacity} />
 */

import {
  useRef,
  useCallback,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import styles from './Slider.module.css';

// ============================================
// Types
// ============================================
export interface SliderProps {
  /** Current value */
  value: number;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Change handler */
  onChange: (value: number) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Show value label */
  showValue?: boolean;
  /** Value formatter for display */
  formatValue?: (value: number) => string;
  /** Aria label */
  'aria-label'?: string;
  /** Additional class name */
  className?: string;
}

// ============================================
// Slider Component
// ============================================
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  showValue = false,
  formatValue,
  'aria-label': ariaLabel,
  className = '',
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Calculate percentage for styling
  const percentage = ((value - min) / (max - min)) * 100;

  // Clamp value to valid range (step aligned to min)
  const clamp = useCallback(
    (val: number): number => {
      // Round to nearest step, anchored at min (not 0)
      const stepped = Math.round((val - min) / step) * step + min;
      return Math.max(min, Math.min(max, stepped));
    },
    [min, max, step]
  );

  // Calculate value from position
  const getValueFromPosition = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return value;

      const rect = trackRef.current.getBoundingClientRect();
      const percent = (clientX - rect.left) / rect.width;
      const rawValue = min + percent * (max - min);
      return clamp(rawValue);
    },
    [min, max, value, clamp]
  );

  // Handle track/thumb click
  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;

      e.preventDefault();
      isDragging.current = true;

      const newValue = getValueFromPosition(e.clientX);
      if (newValue !== value) {
        onChange(newValue);
      }

      // Capture pointer for drag
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled, getValueFromPosition, value, onChange]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current || disabled) return;

      const newValue = getValueFromPosition(e.clientX);
      if (newValue !== value) {
        onChange(newValue);
      }
    },
    [disabled, getValueFromPosition, value, onChange]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      isDragging.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    },
    []
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      let newValue = value;
      const bigStep = step * 10;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          newValue = clamp(value + step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          newValue = clamp(value - step);
          break;
        case 'PageUp':
          newValue = clamp(value + bigStep);
          break;
        case 'PageDown':
          newValue = clamp(value - bigStep);
          break;
        case 'Home':
          newValue = min;
          break;
        case 'End':
          newValue = max;
          break;
        default:
          return;
      }

      e.preventDefault();
      if (newValue !== value) {
        onChange(newValue);
      }
    },
    [disabled, value, step, min, max, clamp, onChange]
  );

  const displayValue = formatValue ? formatValue(value) : value.toString();

  return (
    <div
      className={`${styles.slider} ${className}`}
      data-disabled={disabled || undefined}
    >
      <div
        ref={trackRef}
        className={styles.track}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={displayValue}
        aria-disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <div
          className={styles.fill}
          style={{ width: `${percentage}%` }}
        />
        <div
          className={styles.thumb}
          style={{ left: `${percentage}%` }}
        />
      </div>
      {showValue && (
        <span className={styles.value}>{displayValue}</span>
      )}
    </div>
  );
}

export default Slider;
