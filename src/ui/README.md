# UI Components

Reusable UI primitives and feedback components for SceneDeck.

## Structure

```
src/ui/
├── primitives/     # Basic building blocks
│   ├── Modal.tsx   # Overlay, Container, Header, Body, Footer, Actions, ActionButton
│   └── Modal.module.css
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
