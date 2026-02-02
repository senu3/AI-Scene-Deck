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
const KB = 1024;

export default function EnvironmentSettingsModal({ open, onClose }: EnvironmentSettingsModalProps) {
  useModalKeyboard({ onEscape: onClose, enabled: open });

  const stats = useMemo(() => getThumbnailCacheStats(), [open]);
  const [maxMb, setMaxMb] = useState(Math.round(stats.limits.maxBytes / MB));
  const [maxItems, setMaxItems] = useState(stats.limits.maxItems);
  const [stderrMaxKb, setStderrMaxKb] = useState(128);
  const [maxClipSeconds, setMaxClipSeconds] = useState(60);
  const [maxTotalSeconds, setMaxTotalSeconds] = useState(15 * 60);
  const [maxClipMb, setMaxClipMb] = useState(32);
  const [maxTotalMb, setMaxTotalMb] = useState(256);

  useEffect(() => {
    if (!open) return;
    setMaxMb(Math.round(stats.limits.maxBytes / MB));
    setMaxItems(stats.limits.maxItems);

    let active = true;
    const loadFfmpegLimits = async () => {
      const api = window.electronAPI;
      if (!api?.getFfmpegLimits) return;
      const limits = await api.getFfmpegLimits();
      if (!active) return;
      setStderrMaxKb(Math.round(limits.stderrMaxBytes / KB));
      setMaxClipSeconds(limits.maxClipSeconds);
      setMaxTotalSeconds(limits.maxTotalSeconds);
      setMaxClipMb(Math.round(limits.maxClipBytes / MB));
      setMaxTotalMb(Math.round(limits.maxTotalBytes / MB));
    };
    loadFfmpegLimits();

    return () => {
      active = false;
    };
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

    const safeStderrKb = Number.isFinite(stderrMaxKb) ? Math.max(1, Math.floor(stderrMaxKb)) : 1;
    const safeClipSeconds = Number.isFinite(maxClipSeconds) ? Math.max(1, Math.floor(maxClipSeconds)) : 1;
    const safeTotalSeconds = Number.isFinite(maxTotalSeconds) ? Math.max(1, Math.floor(maxTotalSeconds)) : 1;
    const safeClipMb = Number.isFinite(maxClipMb) ? Math.max(1, Math.floor(maxClipMb)) : 1;
    const safeTotalMb = Number.isFinite(maxTotalMb) ? Math.max(1, Math.floor(maxTotalMb)) : 1;

    window.electronAPI?.setFfmpegLimits?.({
      stderrMaxBytes: safeStderrKb * KB,
      maxClipSeconds: safeClipSeconds,
      maxTotalSeconds: safeTotalSeconds,
      maxClipBytes: safeClipMb * MB,
      maxTotalBytes: safeTotalMb * MB,
    });
    onClose();
  };

  return (
    <Overlay onClick={onClose}>
      <Container size="sm">
        <Header title="Environment Settings" subtitle="Cache and ffmpeg limits" onClose={onClose} />
        <Body>
          <div className={styles.form}>
            <div className={styles.sectionTitle}>Thumbnail cache</div>
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
            <div className={styles.sectionTitle}>FFmpeg limits</div>
            <div className={styles.row}>
              <label className={styles.label} htmlFor="ffmpeg-stderr-kb">
                stderr ring (KB)
              </label>
              <input
                id="ffmpeg-stderr-kb"
                className={styles.input}
                type="number"
                min={1}
                step={1}
                value={stderrMaxKb}
                onChange={(e) => setStderrMaxKb(Number(e.target.value))}
              />
              <div className={styles.help}>Tail buffer size (default 128KB)</div>
            </div>
            <div className={styles.row}>
              <label className={styles.label} htmlFor="pcm-clip-seconds">
                PCM clip max (sec)
              </label>
              <input
                id="pcm-clip-seconds"
                className={styles.input}
                type="number"
                min={1}
                step={1}
                value={maxClipSeconds}
                onChange={(e) => setMaxClipSeconds(Number(e.target.value))}
              />
              <div className={styles.help}>Per-clip limit</div>
            </div>
            <div className={styles.row}>
              <label className={styles.label} htmlFor="pcm-clip-mb">
                PCM clip max (MB)
              </label>
              <input
                id="pcm-clip-mb"
                className={styles.input}
                type="number"
                min={1}
                step={1}
                value={maxClipMb}
                onChange={(e) => setMaxClipMb(Number(e.target.value))}
              />
              <div className={styles.help}>Per-clip bytes cap</div>
            </div>
            <div className={styles.row}>
              <label className={styles.label} htmlFor="pcm-total-seconds">
                PCM total max (sec)
              </label>
              <input
                id="pcm-total-seconds"
                className={styles.input}
                type="number"
                min={1}
                step={1}
                value={maxTotalSeconds}
                onChange={(e) => setMaxTotalSeconds(Number(e.target.value))}
              />
              <div className={styles.help}>Absolute upper bound</div>
            </div>
            <div className={styles.row}>
              <label className={styles.label} htmlFor="pcm-total-mb">
                PCM total max (MB)
              </label>
              <input
                id="pcm-total-mb"
                className={styles.input}
                type="number"
                min={1}
                step={1}
                value={maxTotalMb}
                onChange={(e) => setMaxTotalMb(Number(e.target.value))}
              />
              <div className={styles.help}>Absolute bytes cap</div>
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
