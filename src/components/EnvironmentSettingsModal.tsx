import { useEffect, useMemo, useState } from 'react';
import {
  Overlay,
  Container,
  Header,
  Body,
  Footer,
  Actions,
  ActionButton,
  useModalKeyboard,
} from '../ui/primitives/Modal';
import { getThumbnailCacheStats, setThumbnailCacheLimits } from '../utils/thumbnailCache';
import styles from './EnvironmentSettingsModal.module.css';

export interface EnvironmentSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const MB = 1024 * 1024;

export default function EnvironmentSettingsModal({ open, onClose }: EnvironmentSettingsModalProps) {
  useModalKeyboard({ onEscape: onClose, enabled: open });

  const stats = useMemo(() => getThumbnailCacheStats(), [open]);
  const [maxMb, setMaxMb] = useState(Math.round(stats.limits.maxBytes / MB));
  const [maxItems, setMaxItems] = useState(stats.limits.maxItems);

  useEffect(() => {
    if (!open) return;
    setMaxMb(Math.round(stats.limits.maxBytes / MB));
    setMaxItems(stats.limits.maxItems);
  }, [open, stats.limits.maxBytes, stats.limits.maxItems]);

  if (!open) return null;

  const currentBytesMb = Math.round(stats.bytes / MB);

  const handleSave = () => {
    const safeMb = Number.isFinite(maxMb) ? Math.max(1, Math.floor(maxMb)) : 1;
    const safeItems = Number.isFinite(maxItems) ? Math.max(1, Math.floor(maxItems)) : 1;
    setThumbnailCacheLimits({
      maxBytes: safeMb * MB,
      maxItems: safeItems,
    });
    onClose();
  };

  return (
    <Overlay onClick={onClose}>
      <Container size="sm">
        <Header title="Environment Settings" subtitle="Thumbnail cache limits" onClose={onClose} />
        <Body>
          <div className={styles.form}>
            <div className={styles.row}>
              <label className={styles.label} htmlFor="thumb-max-mb">
                Cache max (MB)
              </label>
              <input
                id="thumb-max-mb"
                className={styles.input}
                type="number"
                min={1}
                step={1}
                value={maxMb}
                onChange={(e) => setMaxMb(Number(e.target.value))}
              />
              <div className={styles.help}>Total bytes cap (LRU)</div>
            </div>
            <div className={styles.row}>
              <label className={styles.label} htmlFor="thumb-max-items">
                Cache max items
              </label>
              <input
                id="thumb-max-items"
                className={styles.input}
                type="number"
                min={1}
                step={1}
                value={maxItems}
                onChange={(e) => setMaxItems(Number(e.target.value))}
              />
              <div className={styles.help}>Secondary guard</div>
            </div>
            <div className={styles.stats}>
              Current usage: {stats.items} items / {currentBytesMb} MB
            </div>
          </div>
        </Body>
        <Footer>
          <Actions>
            <ActionButton variant="secondary" onClick={onClose}>
              Cancel
            </ActionButton>
            <ActionButton variant="primary" onClick={handleSave}>
              Save
            </ActionButton>
          </Actions>
        </Footer>
      </Container>
    </Overlay>
  );
}
