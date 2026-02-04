/**
 * EnvironmentSettingsModal - Redesigned settings modal with tabs
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Settings,
  Monitor,
  Palette,
  Save,
  Zap,
  Database,
  Film,
  Keyboard,
  Code,
  Info,
  RotateCcw,
  HardDrive,
  Clock,
  Play,
  ImageIcon,
  Check,
} from 'lucide-react';
import {
  Overlay,
  Container,
  Header,
  Body,
  useModalKeyboard,
  Tabs,
  Toggle,
  Select,
  SettingsSection,
  SettingsRow,
  StatDisplay,
  Input,
  type TabItem,
} from '../ui';
import { getThumbnailCacheStats, setThumbnailCacheLimits, clearThumbnailCache } from '../utils/thumbnailCache';
import styles from './EnvironmentSettingsModal.module.css';

export interface EnvironmentSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'editor' | 'performance' | 'keyboard' | 'advanced';

type ThemeMode = 'system' | 'dark' | 'light';
type LanguageCode = 'ja' | 'en';
type StartupBehavior = 'last' | 'new' | 'welcome';
type PreviewQuality = 'auto' | 'high' | 'medium' | 'low';

const MB = 1024 * 1024;
const KB = 1024;

const TABS: TabItem[] = [
  { id: 'general', label: 'General', icon: <Monitor size={14} /> },
  { id: 'editor', label: 'Editor', icon: <Play size={14} /> },
  { id: 'performance', label: 'Performance', icon: <Zap size={14} /> },
  { id: 'keyboard', label: 'Keyboard', icon: <Keyboard size={14} />, disabled: true },
  { id: 'advanced', label: 'Advanced', icon: <Code size={14} /> },
];

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light (Coming Soon)' },
];

const LANGUAGE_OPTIONS = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
];

const STARTUP_OPTIONS = [
  { value: 'welcome', label: 'Show Welcome Screen' },
  { value: 'last', label: 'Open Last Project' },
  { value: 'new', label: 'Create New Project' },
];

const PREVIEW_QUALITY_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const PLAYBACK_RATE_OPTIONS = [
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1', label: '1x (Normal)' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
  { value: '2', label: '2x' },
];

export default function EnvironmentSettingsModal({ open, onClose }: EnvironmentSettingsModalProps) {
  useModalKeyboard({ onEscape: onClose, enabled: open });

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [hasChanges, setHasChanges] = useState(false);

  // General settings
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [language, setLanguage] = useState<LanguageCode>('ja');
  const [startupBehavior, setStartupBehavior] = useState<StartupBehavior>('welcome');

  // Editor settings
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [autosaveInterval, setAutosaveInterval] = useState(30);
  const [defaultCutDuration, setDefaultCutDuration] = useState(3);
  const [previewQuality, setPreviewQuality] = useState<PreviewQuality>('auto');
  const [defaultPlaybackRate, setDefaultPlaybackRate] = useState('1');
  const [showThumbnails, setShowThumbnails] = useState(true);

  // Performance settings - Thumbnail cache
  const stats = useMemo(() => getThumbnailCacheStats(), [open]);
  const [maxMb, setMaxMb] = useState(Math.round(stats.limits.maxBytes / MB));
  const [maxItems, setMaxItems] = useState(stats.limits.maxItems);

  // Performance settings - FFmpeg
  const [stderrMaxKb, setStderrMaxKb] = useState(128);
  const [maxClipSeconds, setMaxClipSeconds] = useState(60);
  const [maxTotalSeconds, setMaxTotalSeconds] = useState(15 * 60);
  const [maxClipMb, setMaxClipMb] = useState(32);
  const [maxTotalMb, setMaxTotalMb] = useState(256);
  const [hardwareAcceleration, setHardwareAcceleration] = useState(true);

  // Advanced settings
  const [debugMode, setDebugMode] = useState(false);
  const [verboseLogging, setVerboseLogging] = useState(false);

  // Load settings on open
  useEffect(() => {
    if (!open) return;

    // Reset to initial values
    setMaxMb(Math.round(stats.limits.maxBytes / MB));
    setMaxItems(stats.limits.maxItems);
    setHasChanges(false);

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

  // Track changes
  const handleChange = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>) => {
    return (value: T) => {
      setter(value);
      setHasChanges(true);
    };
  }, []);

  const handleClearCache = useCallback(() => {
    clearThumbnailCache();
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    // Save thumbnail cache settings
    const safeMb = Number.isFinite(maxMb) ? Math.max(1, Math.floor(maxMb)) : 1;
    const safeItems = Number.isFinite(maxItems) ? Math.max(1, Math.floor(maxItems)) : 1;
    setThumbnailCacheLimits({
      maxBytes: safeMb * MB,
      maxItems: safeItems,
    });

    // Save FFmpeg settings
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

    setHasChanges(false);
    onClose();
  }, [maxMb, maxItems, stderrMaxKb, maxClipSeconds, maxTotalSeconds, maxClipMb, maxTotalMb, onClose]);

  const handleResetDefaults = useCallback(() => {
    // Reset to default values
    setTheme('dark');
    setLanguage('ja');
    setStartupBehavior('welcome');
    setAutosaveEnabled(true);
    setAutosaveInterval(30);
    setDefaultCutDuration(3);
    setPreviewQuality('auto');
    setDefaultPlaybackRate('1');
    setShowThumbnails(true);
    setMaxMb(64);
    setMaxItems(200);
    setStderrMaxKb(128);
    setMaxClipSeconds(60);
    setMaxTotalSeconds(15 * 60);
    setMaxClipMb(32);
    setMaxTotalMb(256);
    setHardwareAcceleration(true);
    setDebugMode(false);
    setVerboseLogging(false);
    setHasChanges(true);
  }, []);

  if (!open) return null;

  const currentBytesMb = Math.round(stats.bytes / MB);

  return (
    <Overlay onClick={onClose} blur>
      <Container size="lg">
        <Header
          title="Settings"
          icon={<Settings size={22} />}
          iconVariant="info"
          onClose={onClose}
        />

        <div className={styles.tabsWrapper}>
          <Tabs
            tabs={TABS}
            activeTab={activeTab}
            onChange={(id) => setActiveTab(id as SettingsTab)}
            variant="underline"
          />
        </div>

        <Body className={styles.body}>
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className={styles.tabContent}>
              <SettingsSection title="Appearance" icon={<Palette size={14} />}>
                <SettingsRow label="Theme" description="Choose application color theme">
                  <Select
                    value={theme}
                    options={THEME_OPTIONS}
                    onChange={(v) => handleChange(setTheme)(v as ThemeMode)}
                  />
                </SettingsRow>
                <SettingsRow label="Language" description="Display language">
                  <Select
                    value={language}
                    options={LANGUAGE_OPTIONS}
                    onChange={(v) => handleChange(setLanguage)(v as LanguageCode)}
                  />
                </SettingsRow>
              </SettingsSection>

              <SettingsSection title="Startup" icon={<Monitor size={14} />}>
                <SettingsRow label="On Launch" description="What to show when app starts">
                  <Select
                    value={startupBehavior}
                    options={STARTUP_OPTIONS}
                    onChange={(v) => handleChange(setStartupBehavior)(v as StartupBehavior)}
                  />
                </SettingsRow>
              </SettingsSection>
            </div>
          )}

          {/* Editor Tab */}
          {activeTab === 'editor' && (
            <div className={styles.tabContent}>
              <SettingsSection title="Autosave" icon={<Save size={14} />}>
                <SettingsRow label="Enable Autosave" description="Automatically save changes">
                  <Toggle
                    checked={autosaveEnabled}
                    onChange={handleChange(setAutosaveEnabled)}
                    size="sm"
                  />
                </SettingsRow>
                <SettingsRow label="Save Interval" description="Seconds between saves">
                  <div className={styles.inputWithUnit}>
                    <Input
                      type="number"
                      value={autosaveInterval}
                      onChange={(e) => handleChange(setAutosaveInterval)(Number(e.target.value))}
                      min={5}
                      max={300}
                      step={5}
                      disabled={!autosaveEnabled}
                      className={styles.numberInput}
                    />
                    <span className={styles.inputUnit}>sec</span>
                  </div>
                </SettingsRow>
              </SettingsSection>

              <SettingsSection title="Defaults" icon={<ImageIcon size={14} />}>
                <SettingsRow label="Default Cut Duration" description="Duration for image cuts">
                  <div className={styles.inputWithUnit}>
                    <Input
                      type="number"
                      value={defaultCutDuration}
                      onChange={(e) => handleChange(setDefaultCutDuration)(Number(e.target.value))}
                      min={0.5}
                      max={30}
                      step={0.5}
                      className={styles.numberInput}
                    />
                    <span className={styles.inputUnit}>sec</span>
                  </div>
                </SettingsRow>
              </SettingsSection>

              <SettingsSection title="Preview" icon={<Play size={14} />}>
                <SettingsRow label="Preview Quality" description="Video preview rendering quality">
                  <Select
                    value={previewQuality}
                    options={PREVIEW_QUALITY_OPTIONS}
                    onChange={(v) => handleChange(setPreviewQuality)(v as PreviewQuality)}
                  />
                </SettingsRow>
                <SettingsRow label="Default Playback Speed" description="Initial playback rate">
                  <Select
                    value={defaultPlaybackRate}
                    options={PLAYBACK_RATE_OPTIONS}
                    onChange={handleChange(setDefaultPlaybackRate)}
                  />
                </SettingsRow>
                <SettingsRow label="Show Thumbnails" description="Display thumbnails in timeline">
                  <Toggle
                    checked={showThumbnails}
                    onChange={handleChange(setShowThumbnails)}
                    size="sm"
                  />
                </SettingsRow>
              </SettingsSection>
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className={styles.tabContent}>
              <SettingsSection title="Thumbnail Cache" icon={<Database size={14} />}>
                <div className={styles.statsRow}>
                  <StatDisplay label="Items" value={stats.items} />
                  <StatDisplay label="Size" value={currentBytesMb} unit="MB" />
                </div>
                <SettingsRow label="Max Cache Size" description="Maximum memory usage">
                  <div className={styles.inputWithUnit}>
                    <Input
                      type="number"
                      value={maxMb}
                      onChange={(e) => handleChange(setMaxMb)(Number(e.target.value))}
                      min={1}
                      max={512}
                      step={8}
                      className={styles.numberInput}
                    />
                    <span className={styles.inputUnit}>MB</span>
                  </div>
                </SettingsRow>
                <SettingsRow label="Max Items" description="Maximum cached thumbnails">
                  <div className={styles.inputWithUnit}>
                    <Input
                      type="number"
                      value={maxItems}
                      onChange={(e) => handleChange(setMaxItems)(Number(e.target.value))}
                      min={10}
                      max={1000}
                      step={10}
                      className={styles.numberInput}
                    />
                    <span className={styles.inputUnit}>items</span>
                  </div>
                </SettingsRow>
                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleClearCache}
                  >
                    <HardDrive size={14} />
                    Clear Cache
                  </button>
                </div>
              </SettingsSection>

              <SettingsSection title="FFmpeg Limits" icon={<Film size={14} />}>
                <SettingsRow label="Hardware Acceleration" description="Use GPU for encoding">
                  <Toggle
                    checked={hardwareAcceleration}
                    onChange={handleChange(setHardwareAcceleration)}
                    size="sm"
                  />
                </SettingsRow>
                <SettingsRow label="Stderr Buffer" description="Log buffer size">
                  <div className={styles.inputWithUnit}>
                    <Input
                      type="number"
                      value={stderrMaxKb}
                      onChange={(e) => handleChange(setStderrMaxKb)(Number(e.target.value))}
                      min={16}
                      max={1024}
                      step={16}
                      className={styles.numberInput}
                    />
                    <span className={styles.inputUnit}>KB</span>
                  </div>
                </SettingsRow>
              </SettingsSection>

              <SettingsSection title="PCM Audio Limits" icon={<Clock size={14} />}>
                <SettingsRow label="Per-Clip Duration" description="Maximum clip length">
                  <div className={styles.inputWithUnit}>
                    <Input
                      type="number"
                      value={maxClipSeconds}
                      onChange={(e) => handleChange(setMaxClipSeconds)(Number(e.target.value))}
                      min={10}
                      max={600}
                      step={10}
                      className={styles.numberInput}
                    />
                    <span className={styles.inputUnit}>sec</span>
                  </div>
                </SettingsRow>
                <SettingsRow label="Per-Clip Size" description="Maximum clip memory">
                  <div className={styles.inputWithUnit}>
                    <Input
                      type="number"
                      value={maxClipMb}
                      onChange={(e) => handleChange(setMaxClipMb)(Number(e.target.value))}
                      min={8}
                      max={256}
                      step={8}
                      className={styles.numberInput}
                    />
                    <span className={styles.inputUnit}>MB</span>
                  </div>
                </SettingsRow>
                <SettingsRow label="Total Duration" description="Maximum total audio">
                  <div className={styles.inputWithUnit}>
                    <Input
                      type="number"
                      value={Math.round(maxTotalSeconds / 60)}
                      onChange={(e) => handleChange(setMaxTotalSeconds)(Number(e.target.value) * 60)}
                      min={1}
                      max={60}
                      step={1}
                      className={styles.numberInput}
                    />
                    <span className={styles.inputUnit}>min</span>
                  </div>
                </SettingsRow>
                <SettingsRow label="Total Size" description="Maximum total memory">
                  <div className={styles.inputWithUnit}>
                    <Input
                      type="number"
                      value={maxTotalMb}
                      onChange={(e) => handleChange(setMaxTotalMb)(Number(e.target.value))}
                      min={64}
                      max={1024}
                      step={64}
                      className={styles.numberInput}
                    />
                    <span className={styles.inputUnit}>MB</span>
                  </div>
                </SettingsRow>
              </SettingsSection>
            </div>
          )}

          {/* Keyboard Tab (Placeholder) */}
          {activeTab === 'keyboard' && (
            <div className={styles.tabContent}>
              <SettingsSection title="Keyboard Shortcuts" icon={<Keyboard size={14} />}>
                <div className={styles.comingSoon}>
                  <Keyboard size={48} strokeWidth={1} />
                  <h3>Coming Soon</h3>
                  <p>Keyboard shortcut customization will be available in a future update.</p>
                </div>
              </SettingsSection>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className={styles.tabContent}>
              <SettingsSection title="Developer Options" icon={<Code size={14} />}>
                <SettingsRow label="Debug Mode" description="Show debug information">
                  <Toggle
                    checked={debugMode}
                    onChange={handleChange(setDebugMode)}
                    size="sm"
                  />
                </SettingsRow>
                <SettingsRow label="Verbose Logging" description="Enable detailed logs">
                  <Toggle
                    checked={verboseLogging}
                    onChange={handleChange(setVerboseLogging)}
                    size="sm"
                  />
                </SettingsRow>
              </SettingsSection>

              <SettingsSection title="Data Management" icon={<HardDrive size={14} />}>
                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleResetDefaults}
                  >
                    <RotateCcw size={14} />
                    Reset to Defaults
                  </button>
                </div>
              </SettingsSection>

              <SettingsSection title="About" icon={<Info size={14} />}>
                <div className={styles.aboutInfo}>
                  <div className={styles.aboutRow}>
                    <span className={styles.aboutLabel}>Application</span>
                    <span className={styles.aboutValue}>AI-Scene-Deck</span>
                  </div>
                  <div className={styles.aboutRow}>
                    <span className={styles.aboutLabel}>Version</span>
                    <span className={styles.aboutValue}>1.0.0</span>
                  </div>
                  <div className={styles.aboutRow}>
                    <span className={styles.aboutLabel}>Electron</span>
                    <span className={styles.aboutValue}>{window.electronAPI?.getVersions?.()?.electron || 'N/A'}</span>
                  </div>
                </div>
              </SettingsSection>
            </div>
          )}
        </Body>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {hasChanges && (
              <span className={styles.unsavedBadge}>
                <span className={styles.unsavedDot} />
                Unsaved changes
              </span>
            )}
          </div>
          <div className={styles.footerActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
            >
              <Check size={16} />
              Save Settings
            </button>
          </div>
        </div>
      </Container>
    </Overlay>
  );
}
