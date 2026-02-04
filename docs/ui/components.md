# UI Components

**目的**: UIプリミティブとフィードバック系コンポーネントの参照。
**適用範囲**: `src/ui/*`。
**関連ファイル**: `src/ui/primitives/`, `src/ui/patterns/`, `src/ui/feedback/`。
**更新頻度**: 中。

## Structure

```
src/ui/
├── primitives/        # Basic building blocks
│   ├── Modal.tsx      # Overlay, Container, Header, Body, Footer, Actions, ActionButton
│   ├── Tooltip.tsx    # Hover/focus tooltip for explanations
│   ├── FormControls.tsx # Input, Select, RadioGroup, Checkbox
│   └── *.module.css
├── patterns/          # Combined components for consistent UX
│   ├── Field.tsx      # Label + hint + error wrapper
│   ├── DisabledReason.tsx # Balloon for disabled state reasons
│   └── *.module.css
├── feedback/          # Notification/dialog components
│   ├── Toast.tsx      # ToastProvider, useToast
│   ├── Dialog.tsx     # DialogProvider, useDialog (confirm/alert)
│   ├── Banner.tsx     # BannerProvider, useBanner (persistent notifications)
│   └── *.module.css
└── index.ts           # Main export
```

## Usage

### Setup (in main.tsx)

```tsx
import { ToastProvider, DialogProvider, BannerProvider } from './ui';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <DialogProvider>
      <BannerProvider>
        <App />
      </BannerProvider>
    </DialogProvider>
  </ToastProvider>
);
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

  // Toast with action button (CTA)
  const handleAutosaveError = () => {
    toast.error('Autosave failed', 'Please save manually.', {
      id: 'autosave-failed',
      duration: 0,
      action: {
        label: 'Save Now',
        onClick: () => saveProject(),
      },
    });
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

### Toast Options

| Option    | Type         | Description |
|-----------|--------------|-------------|
| duration  | number       | Duration in ms. 0 = persistent (manual dismiss) |
| id        | string       | Unique ID for deduplication |
| action    | ToastAction  | Action button (CTA) |

### Toast Action

For toasts that need user action (e.g., autosave failure, retry prompts):

```tsx
toast.error('Autosave failed', 'Changes may be lost.', {
  id: 'autosave-failed',
  duration: 0,  // Persistent until dismissed
  action: {
    label: 'Save Now',
    onClick: () => handleManualSave(),
  },
});
```

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

## Banner

For persistent/ongoing state notifications (network status, sync progress):

```tsx
import { useBanner } from './ui';

function MyComponent() {
  const { banner } = useBanner();

  // Show persistent warning
  banner.show({
    id: 'offline',
    variant: 'warning',
    message: 'You are offline. Changes will sync when reconnected.',
    icon: 'wifi-off',
    dismissible: true,
  });

  // Show progress
  const id = banner.show({
    variant: 'progress',
    message: 'Exporting video...',
    progress: 0,
  });
  // Update progress
  banner.update(id, { progress: 50, message: 'Exporting video... 50%' });
  // Dismiss when done
  banner.dismiss(id);
}
```

| Variant   | Use Case |
|-----------|----------|
| info      | Information banner |
| warning   | Ongoing warning (offline, unsaved) |
| error     | Persistent error state |
| progress  | Long-running operation |

## Tooltip

For hover/focus explanations (NOT for disabled reasons):

```tsx
import { Tooltip } from './ui';

<Tooltip content="Export all scenes as video" position="bottom">
  <button>Export</button>
</Tooltip>
```

| Position | Description |
|----------|-------------|
| top      | Above trigger (default) |
| bottom   | Below trigger |
| left     | Left of trigger |
| right    | Right of trigger |

## Field

For form inputs with label, hint, and error support:

```tsx
import { Field, Input } from './ui';

<Field label="Project Name" hint="Used as export filename" error={errors.name}>
  <Input value={name} onChange={...} />
</Field>

// Inline layout
<Field label="FPS" inline>
  <Input type="number" value={fps} />
</Field>
```

## DisabledReason

For explaining why an action is disabled (wraps element to capture hover):

```tsx
import { DisabledReason } from './ui';

<DisabledReason reason="Select a clip first" disabled={!hasSelection}>
  <button disabled={!hasSelection}>Export</button>
</DisabledReason>
```

Use for important actions (Export, Delete) where users need to understand why disabled.

## Notification Guidelines

| Situation | Component |
|-----------|-----------|
| Success | Toast (short) |
| Failure | Toast (long) + action |
| Ongoing state | Banner |
| Destructive action | Confirm modal (danger) |
| Form validation | Inline error (Field) |
| Disabled reason | DisabledReason (balloon) |
| Explanation | Tooltip |

## Related Docs
- `docs/ui/color-system.md`
