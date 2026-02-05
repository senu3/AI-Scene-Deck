/**
 * AssetContextMenu Pattern
 *
 * Context menu for unused assets in the asset panel.
 * Provides delete (move to trash) functionality.
 */
import { Trash2 } from 'lucide-react';
import {
  ContextMenu,
  MenuHeader,
  MenuItem,
  MenuSeparator,
  type ContextMenuPosition,
} from '../primitives/menu';

export interface AssetContextMenuProps {
  position: ContextMenuPosition;
  onClose: () => void;
  /** Delete handler (move to trash) */
  onDelete: () => void;
}

export function AssetContextMenu({
  position,
  onClose,
  onDelete,
}: AssetContextMenuProps) {
  return (
    <ContextMenu position={position} onClose={onClose}>
      <MenuHeader>Asset options</MenuHeader>
      <MenuSeparator />
      <MenuItem icon={<Trash2 size={14} />} variant="danger" onClick={onDelete}>
        Delete (Move to Trash)
      </MenuItem>
    </ContextMenu>
  );
}
