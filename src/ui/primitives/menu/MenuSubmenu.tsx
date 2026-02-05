/**
 * MenuSubmenu
 *
 * A menu item that opens a submenu on hover.
 */
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { ChevronRight } from 'lucide-react';
import styles from './Menu.module.css';

export interface MenuSubmenuProps {
  /** The label displayed for the submenu trigger */
  label: ReactNode;
  /** Icon to display before the label */
  icon?: ReactNode;
  /** Submenu content (MenuItems, MenuSeparators, etc.) */
  children: ReactNode;
  /** Whether the submenu trigger is disabled */
  disabled?: boolean;
  /** Additional class for the container */
  className?: string;
}

export function MenuSubmenu({
  label,
  icon,
  children,
  disabled = false,
  className,
}: MenuSubmenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openDirection, setOpenDirection] = useState<'right' | 'left'>('right');
  const containerRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  // Calculate submenu position
  const updateSubmenuPosition = useCallback(() => {
    if (!containerRef.current || !submenuRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const submenuWidth = submenuRef.current.offsetWidth || 150;
    const viewportWidth = window.innerWidth;

    // Check if submenu would overflow right edge
    if (containerRect.right + submenuWidth > viewportWidth) {
      setOpenDirection('left');
    } else {
      setOpenDirection('right');
    }
  }, []);

  // Update position when opening
  useEffect(() => {
    if (isOpen) {
      updateSubmenuPosition();
    }
  }, [isOpen, updateSubmenuPosition]);

  const handleMouseEnter = () => {
    if (disabled) return;
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    // Delay closing to allow moving to submenu
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(true);
      // Focus first item in submenu
      requestAnimationFrame(() => {
        const firstItem = submenuRef.current?.querySelector('button');
        firstItem?.focus();
      });
    } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${styles.submenuContainer} ${className || ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      role="menuitem"
      aria-haspopup="true"
      aria-expanded={isOpen}
    >
      <button
        className={`${styles.menuItem} ${styles.submenuTrigger}`}
        disabled={disabled}
        tabIndex={0}
        type="button"
      >
        {icon && <span className={styles.menuItemIcon}>{icon}</span>}
        <span className={styles.menuItemLabel}>{label}</span>
        <span className={styles.submenuArrow}>
          <ChevronRight size={14} />
        </span>
      </button>

      {isOpen && (
        <div
          ref={submenuRef}
          className={`${styles.submenu} ${openDirection === 'left' ? styles.left : ''}`}
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  );
}
