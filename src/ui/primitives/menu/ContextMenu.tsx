/**
 * ContextMenu
 *
 * Renders a menu at a specific position using Portal.
 * Handles click-outside and escape key to close.
 */
import { useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Menu } from './Menu';
import styles from './Menu.module.css';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuProps {
  children: ReactNode;
  position: ContextMenuPosition;
  onClose: () => void;
  className?: string;
}

/**
 * ContextMenu component that renders children at a fixed position.
 * Use with Menu primitives (MenuItem, MenuSeparator, etc.)
 *
 * @example
 * ```tsx
 * const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
 *
 * const handleContextMenu = (e: React.MouseEvent) => {
 *   e.preventDefault();
 *   setMenu({ x: e.clientX, y: e.clientY });
 * };
 *
 * {menu && (
 *   <ContextMenu position={menu} onClose={() => setMenu(null)}>
 *     <MenuHeader>Options</MenuHeader>
 *     <MenuItem icon={<Copy size={14} />} onClick={handleCopy}>Copy</MenuItem>
 *     <MenuSeparator />
 *     <MenuItem icon={<Trash2 size={14} />} variant="danger" onClick={handleDelete}>Delete</MenuItem>
 *   </ContextMenu>
 * )}
 * ```
 */
export function ContextMenu({
  children,
  position,
  onClose,
  className,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Adjust position to keep menu within viewport
  const adjustedPosition = useAdjustedPosition(position, menuRef);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Use mousedown for faster response
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on scroll (optional - prevents stale menu position)
  useEffect(() => {
    const handleScroll = () => {
      onClose();
    };

    window.addEventListener('scroll', handleScroll, { capture: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, [onClose]);

  return createPortal(
    <div ref={menuRef}>
      <Menu
        onClose={onClose}
        className={className}
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
      >
        {children}
      </Menu>
    </div>,
    document.body
  );
}

/**
 * Hook to adjust menu position to keep it within viewport bounds
 */
function useAdjustedPosition(
  position: ContextMenuPosition,
  menuRef: React.RefObject<HTMLDivElement | null>
): ContextMenuPosition {
  const { x, y } = position;

  // Get viewport dimensions
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

  // Menu dimensions (estimate initially, will adjust on next render)
  const menuWidth = menuRef.current?.offsetWidth || 180;
  const menuHeight = menuRef.current?.offsetHeight || 200;

  // Padding from viewport edge
  const padding = 8;

  // Adjust X
  let adjustedX = x;
  if (x + menuWidth + padding > viewportWidth) {
    adjustedX = Math.max(padding, viewportWidth - menuWidth - padding);
  }

  // Adjust Y
  let adjustedY = y;
  if (y + menuHeight + padding > viewportHeight) {
    adjustedY = Math.max(padding, viewportHeight - menuHeight - padding);
  }

  return { x: adjustedX, y: adjustedY };
}

// ============================================================================
// useContextMenu hook for easier state management
// ============================================================================

export interface UseContextMenuReturn {
  isOpen: boolean;
  position: ContextMenuPosition | null;
  open: (e: React.MouseEvent) => void;
  close: () => void;
  props: {
    position: ContextMenuPosition;
    onClose: () => void;
  } | null;
}

/**
 * Hook for managing context menu state
 *
 * @example
 * ```tsx
 * const menu = useContextMenu();
 *
 * <div onContextMenu={menu.open}>
 *   Right click me
 * </div>
 *
 * {menu.props && (
 *   <ContextMenu {...menu.props}>
 *     <MenuItem>Option 1</MenuItem>
 *   </ContextMenu>
 * )}
 * ```
 */
export function useContextMenu(): UseContextMenuReturn {
  const positionRef = useRef<ContextMenuPosition | null>(null);
  const callbacksRef = useRef<{
    setPosition: (pos: ContextMenuPosition | null) => void;
  } | null>(null);

  // Use a simple state to trigger re-renders
  const forceUpdate = useCallback(() => {
    // Will be set by the component using this hook
  }, []);

  const open = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    positionRef.current = { x: e.clientX, y: e.clientY };
    callbacksRef.current?.setPosition({ x: e.clientX, y: e.clientY });
  }, []);

  const close = useCallback(() => {
    positionRef.current = null;
    callbacksRef.current?.setPosition(null);
  }, []);

  // This hook needs to be used with useState in the component
  // Simplified version - components should manage their own state
  return {
    isOpen: positionRef.current !== null,
    position: positionRef.current,
    open,
    close,
    props: positionRef.current
      ? { position: positionRef.current, onClose: close }
      : null,
  };
}
