/**
 * DisabledReason - Wrapper that shows reason balloon on disabled elements
 *
 * Usage:
 * <DisabledReason reason="Select a clip first" disabled={!hasSelection}>
 *   <button disabled={!hasSelection}>Export</button>
 * </DisabledReason>
 *
 * Note: Wraps disabled elements because they don't receive hover events.
 * Use for important actions like Export where users need to understand why disabled.
 */

import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './DisabledReason.module.css';

// ============================================
// Types
// ============================================
export type BalloonPosition = 'top' | 'bottom' | 'left' | 'right';

export interface DisabledReasonProps {
  /** Reason why the element is disabled */
  reason: string;
  /** Whether the wrapped element is disabled */
  disabled: boolean;
  /** Position of the balloon */
  position?: BalloonPosition;
  /** Wrapped element */
  children: ReactNode;
  /** Additional class name */
  className?: string;
}

// ============================================
// DisabledReason Component
// ============================================
export function DisabledReason({
  reason,
  disabled,
  position = 'top',
  children,
  className = '',
}: DisabledReasonProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const balloonRef = useRef<HTMLDivElement>(null);

  const show = () => {
    if (disabled) {
      setVisible(true);
    }
  };

  const hide = () => {
    setVisible(false);
  };

  // Calculate position when visible
  useEffect(() => {
    if (!visible || !wrapperRef.current || !balloonRef.current) return;

    const wrapper = wrapperRef.current.getBoundingClientRect();
    const balloon = balloonRef.current.getBoundingClientRect();
    const gap = 8;

    let x = 0;
    let y = 0;

    switch (position) {
      case 'top':
        x = wrapper.left + wrapper.width / 2 - balloon.width / 2;
        y = wrapper.top - balloon.height - gap;
        break;
      case 'bottom':
        x = wrapper.left + wrapper.width / 2 - balloon.width / 2;
        y = wrapper.bottom + gap;
        break;
      case 'left':
        x = wrapper.left - balloon.width - gap;
        y = wrapper.top + wrapper.height / 2 - balloon.height / 2;
        break;
      case 'right':
        x = wrapper.right + gap;
        y = wrapper.top + wrapper.height / 2 - balloon.height / 2;
        break;
    }

    // Keep within viewport
    x = Math.max(8, Math.min(x, window.innerWidth - balloon.width - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - balloon.height - 8));

    setCoords({ x, y });
  }, [visible, position]);

  // If not disabled, just render children
  if (!disabled) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={wrapperRef}
        className={`${styles.wrapper} ${className}`}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </div>
      {visible &&
        createPortal(
          <div
            ref={balloonRef}
            className={styles.balloon}
            data-position={position}
            style={{ left: coords.x, top: coords.y }}
            role="tooltip"
          >
            {reason}
          </div>,
          document.body
        )}
    </>
  );
}

export default DisabledReason;
