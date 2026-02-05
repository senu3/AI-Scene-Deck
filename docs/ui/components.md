# UI Components

**目的**: UIプリミティブとフィードバック系コンポーネントの参照。
**適用範囲**: `src/ui/*`。
**関連ファイル**: `src/ui/primitives/Modal.tsx`, `src/ui/primitives/menu/`, `src/ui/feedback/Toast.tsx`, `src/ui/feedback/Dialog.tsx`。
**更新頻度**: 中。

## Structure

```
src/ui/
├── primitives/     # Basic building blocks
│   ├── Modal.tsx   # Overlay, Container, Header, Body, Footer, Actions, ActionButton
│   ├── Modal.module.css
│   └── menu/       # Context menu primitives
│       ├── Menu.tsx           # Menu, MenuHeader, MenuItem, MenuSeparator, MenuCheckboxItem
│       ├── ContextMenu.tsx    # ContextMenu (Portal-based positioning)
│       ├── MenuSubmenu.tsx    # MenuSubmenu (nested menus)
│       ├── Menu.module.css
│       └── index.ts
├── patterns/       # SceneDeck-specific compositions
│   ├── CutContextMenu.tsx    # Pre-built menu for cut operations
│   ├── AssetContextMenu.tsx  # Pre-built menu for asset operations
│   └── index.ts
├── feedback/       # Notification/dialog components
│   ├── Toast.tsx   # ToastProvider, useToast
│   ├── Dialog.tsx  # DialogProvider, useDialog (confirm/alert)
│   └── *.module.css
└── index.ts        # Main export
```

## Usage

### Setup (in App.tsx)

```tsx
import { ToastProvider, DialogProvider } from './ui';

function App() {
  return (
    <ToastProvider>
      <DialogProvider>
        {/* Your app content */}
      </DialogProvider>
    </ToastProvider>
  );
}
```

### Toast

```tsx
import { useToast } from './ui';

function MyComponent() {
  const { toast } = useToast();

  const handleSave = () => {
    toast.success('Saved!');
  };

  const handleError = () => {
    toast.error('Failed to save', 'Check your connection');
  };

  // Persistent toast (duration: 0)
  const handleProcessing = () => {
    const id = toast.info('Processing...', undefined, { duration: 0 });
    // Later: toast.dismiss(id);
  };
}
```

### Confirm/Alert Dialog

```tsx
import { useDialog } from './ui';

function MyComponent() {
  const { alert, confirm } = useDialog();

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Clip',
      message: 'This action cannot be undone.',
      targetName: 'clip_001.mp4',
      variant: 'danger',
    });

    if (confirmed) {
      // Proceed with delete
    }
  };

  const handleError = async () => {
    await alert({
      title: 'Error',
      message: 'Something went wrong',
      variant: 'danger',
    });
  };
}
```

### Modal Primitives

```tsx
import {
  Overlay,
  Container,
  Header,
  Body,
  Footer,
  Actions,
  ActionButton,
  useModalKeyboard,
} from './ui';

function CustomModal({ open, onClose }) {
  useModalKeyboard({ onEscape: onClose, enabled: open });

  if (!open) return null;

  return (
    <Overlay onClick={onClose}>
      <Container size="md">
        <Header title="Custom Modal" onClose={onClose} />
        <Body>
          <p>Modal content here</p>
        </Body>
        <Footer>
          <Actions>
            <ActionButton variant="secondary" onClick={onClose}>
              Cancel
            </ActionButton>
            <ActionButton variant="primary" onClick={handleConfirm}>
              Confirm
            </ActionButton>
          </Actions>
        </Footer>
      </Container>
    </Overlay>
  );
}
```

## Toast Variants

| Variant   | Duration | Use Case |
|-----------|----------|----------|
| success   | 4s       | Operation completed |
| info      | 4s       | Information |
| warning   | 6s       | Warning message |
| error     | 6s       | Error occurred |

## Dialog Variants

| Variant   | Icon | Use Case |
|-----------|------|----------|
| default   | AlertCircle | General confirmation |
| info      | Info | Information dialog |
| warning   | AlertTriangle | Warning confirmation |
| danger    | AlertTriangle (red) | Destructive action |

### Danger Dialogs

For danger dialogs:
- Cancel button is visually emphasized
- Target name is displayed if provided
- Use for irreversible actions like delete

## Context Menu Primitives

### Basic Context Menu

```tsx
import {
  ContextMenu,
  MenuHeader,
  MenuItem,
  MenuSeparator,
  MenuSubmenu,
} from './ui';
import { Copy, Trash2, ArrowRightLeft } from 'lucide-react';

function MyComponent() {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div onContextMenu={handleContextMenu}>
        Right click me
      </div>

      {menu && (
        <ContextMenu position={menu} onClose={() => setMenu(null)}>
          <MenuHeader>Options</MenuHeader>
          <MenuItem icon={<Copy size={14} />} onClick={handleCopy}>
            Copy
          </MenuItem>
          <MenuItem disabled={!canPaste}>Paste</MenuItem>
          <MenuSeparator />
          <MenuSubmenu label="Move to" icon={<ArrowRightLeft size={14} />}>
            <MenuItem onClick={() => handleMove('scene1')}>Scene 1</MenuItem>
            <MenuItem onClick={() => handleMove('scene2')}>Scene 2</MenuItem>
          </MenuSubmenu>
          <MenuSeparator />
          <MenuItem icon={<Trash2 size={14} />} variant="danger" onClick={handleDelete}>
            Delete
          </MenuItem>
        </ContextMenu>
      )}
    </>
  );
}
```

### MenuItem Variants

| Variant   | Color | Use Case |
|-----------|-------|----------|
| default   | text-primary | Normal actions |
| danger    | accent-danger | Destructive actions |
| action    | accent-purple | Clip operations, special actions |
| success   | accent-success | Positive actions |

### Pre-built Patterns

For common use cases, use pre-built patterns from `src/ui/patterns/`:

```tsx
import { CutContextMenu, AssetContextMenu } from './ui';

// Cut context menu (for Storyline cuts)
<CutContextMenu
  position={contextMenu}
  isMultiSelect={selectedCount > 1}
  selectedCount={selectedCount}
  scenes={scenes}
  currentSceneId={sceneId}
  canPaste={canPaste}
  isClip={isClip}
  isInGroup={isInGroup}
  onClose={() => setContextMenu(null)}
  onCopy={handleCopy}
  onPaste={handlePaste}
  onDelete={handleDelete}
  onMoveToScene={handleMoveToScene}
/>

// Asset context menu (for unused assets)
<AssetContextMenu
  position={contextMenu}
  onClose={() => setContextMenu(null)}
  onDelete={handleDelete}
/>
```

### Keyboard Navigation

Menu primitives support keyboard navigation:
- `↑` / `↓`: Navigate items
- `Enter` / `Space`: Select item
- `Escape`: Close menu
- `→` / `←`: Open/close submenus

## Related Docs
- `docs/ui/color-system.md`
