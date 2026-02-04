/**
 * Tooltip - Hover/focus tooltip for explanations
 *
 * Usage:
 * <Tooltip content="Explanation text">
 *   <button>Hover me</button>
 * </Tooltip>
 *
 * Note: For disabled state reasons, use DisabledReason instead.
 */

import {
  useState,
  useRef,
  useEffect,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

// ============================================
// Types
// ============================================
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** Tooltip content */
  content: ReactNode;
  /** Position relative to trigger */
  position?: TooltipPosition;
  /** Delay before showing (ms) */
  delay?: number;
  /** Trigger element */
  children: ReactElement;
  /** Disable tooltip */
  disabled?: boolean;
}

// ============================================
// Tooltip Component
// ============================================
export function Tooltip({
  content,
  position = 'top',
  delay = 200,
  children,
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const show = () => {
    if (disabled) return;
    timeoutRef.current = window.setTimeout(() => {
      setVisible(true);
    }, delay);
  };

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  };

  // Calculate position when visible
  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const gap = 8;

    let x = 0;
    let y = 0;

    switch (position) {
      case 'top':
        x = trigger.left + trigger.width / 2 - tooltip.width / 2;
        y = trigger.top - tooltip.height - gap;
        break;
      case 'bottom':
        x = trigger.left + trigger.width / 2 - tooltip.width / 2;
        y = trigger.bottom + gap;
        break;
      case 'left':
        x = trigger.left - tooltip.width - gap;
        y = trigger.top + trigger.height / 2 - tooltip.height / 2;
        break;
      case 'right':
        x = trigger.right + gap;
        y = trigger.top + trigger.height / 2 - tooltip.height / 2;
        break;
    }

    // Keep within viewport
    x = Math.max(8, Math.min(x, window.innerWidth - tooltip.width - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - tooltip.height - 8));

    setCoords({ x, y });
  }, [visible, position]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!isValidElement(children)) {
    return children;
  }

  const trigger = cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: (e: MouseEvent) => {
      show();
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e: MouseEvent) => {
      hide();
      children.props.onMouseLeave?.(e);
    },
    onFocus: (e: FocusEvent) => {
      show();
      children.props.onFocus?.(e);
    },
    onBlur: (e: FocusEvent) => {
      hide();
      children.props.onBlur?.(e);
    },
  } as Record<string, unknown>);

  return (
    <>
      {trigger}
      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            className={styles.tooltip}
            data-position={position}
            style={{ left: coords.x, top: coords.y }}
            role="tooltip"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}

export default Tooltip;
