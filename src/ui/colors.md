# Color System

AI-Scene-Deck uses a slate-tinted dark color scheme with cool cyan accents.

## Color Variables

### Background Colors (globals.css)

| Variable | HEX | Usage |
|----------|-----|-------|
| `--bg-primary` | #0f172a | Main background (header, footer, panels) |
| `--bg-secondary` | #151c2c | Cards, elevated surfaces |
| `--bg-tertiary` | #0d1321 | Deepest background (storyline area) |
| `--bg-hover` | #334155 | Hover states |
| `--bg-selected` | #3b4a5f | Selected states |

### Text Colors

| Variable | HEX | Usage |
|----------|-----|-------|
| `--text-primary` | #f1f5f9 | Primary text (headings, values) |
| `--text-secondary` | #94a3b8 | Secondary text (labels, descriptions) |
| `--text-muted` | #64748b | Muted text (placeholders, icons) |

### Border Colors

| Variable | HEX | Usage |
|----------|-----|-------|
| `--border-color` | #334155 | Default borders |
| `--border-light` | #475569 | Lighter borders |

### Accent Colors (globals.css)

| Variable | HEX | Usage |
|----------|-----|-------|
| `--accent-primary` | #00b4d8 | Primary accent, single selection, notes |
| `--accent-secondary` | #3b82f6 | Secondary role color (blue), cut usage indicators |
| `--accent-success` | #10b981 | Success states, apply actions |
| `--accent-warning` | #f59e0b | Warnings only |
| `--accent-danger` | #ef4444 | Danger, delete actions |
| `--accent-purple` | #8b5cf6 | Lip Sync gradient end |
| `--accent-pink` | #ec4899 | Lip Sync gradient start |

### Semantic Colors

| Variable | HEX | RGB Variable | Usage |
|----------|-----|--------------|-------|
| `--accent-secondary` | #3b82f6 | `--accent-secondary-rgb` | Cut usage in AssetDrawer |
| `--accent-video` | #6366f1 | `--accent-video-rgb` | Video files, clip trimming |
| `--accent-audio` | #a855f7 | `--accent-audio-rgb` | Audio files, attached audio |
| `--accent-group` | #14b8a6 | `--accent-group-rgb` | Groups, multi-selection |
| `--accent-success` | #10b981 | `--accent-success-rgb` | Success states with transparency |
| `--accent-warning` | #f59e0b | `--accent-warning-rgb` | Warning states with transparency |
| `--accent-danger` | #ef4444 | `--accent-danger-rgb` | Danger states with transparency |

## Color Spectrum

```
Cool Color Gradient:

#00b4d8    #14b8a6    #10b981    #6366f1    #a855f7
  ●          ●          ●          ●          ●
Primary   Group      Success    Video      Audio
Selection Multi-sel  Apply      Clip       Attached
Notes
```

## Usage Rules

### Selection States

| State | Color | Variable |
|-------|-------|----------|
| Single selection | Cyan | `--accent-primary` |
| Multi-selection | Teal | `--accent-group` |
| Group selection | Teal | `--accent-group` |

### Asset Types

| Type | Color | Variable |
|------|-------|----------|
| Video (S:VID) | Indigo | `--accent-video` |
| Image (S:IMG) | Cyan | `--accent-primary` |
| Audio | Purple | `--accent-audio` |

### Cut Card Indicators

| Indicator | Color | Variable |
|-----------|-------|----------|
| Clip (trimmed video) | Indigo | `--accent-video` |
| Attached audio | Purple | `--accent-audio` |
| Lip Sync | Pink→Purple gradient | `--accent-pink` → `--accent-purple` |

### Action States

| Action | Color | Variable |
|--------|-------|----------|
| Success/Apply | Green | `--accent-success` |
| Warning | Orange | `--accent-warning` |
| Danger/Delete | Red | `--accent-danger` |

### Buttons

| Button | Color | Class |
|--------|-------|-------|
| CREATE GROUP | Teal | `.action-btn.create-group` |
| ATTACH AUDIO | Neutral | `.action-btn.secondary` |
| Primary actions | Blue→Purple | `.action-btn.primary` |
| Lip Sync actions | Pink→Purple | `.action-btn.lip-sync` |

## Transparency Guidelines

When using colors with transparency, use the RGB variables:

```css
/* Background with 10% opacity */
background-color: rgba(var(--accent-group-rgb), 0.1);

/* Border with 20% opacity */
border: 1px solid rgba(var(--accent-video-rgb), 0.2);

/* Box shadow with 30% opacity */
box-shadow: 0 0 0 2px rgba(var(--accent-audio-rgb), 0.3);
```

### Common Opacity Values

| Usage | Opacity |
|-------|---------|
| Background tint | 0.05 - 0.1 |
| Border | 0.2 - 0.3 |
| Box shadow | 0.3 |
| Badge background | 0.9 |
| Hover state | 1.0 |

## Component Color Mapping

### CutGroupCard

- Selected border: `--accent-group`
- Group badge: `rgba(var(--accent-group-rgb), 0.9)`
- Expanded container border: `--accent-group`
- Expanded header background: `rgba(var(--accent-group-rgb), 0.15)`

### CutCard

- Selected border: `--accent-primary`
- Multi-selected border: `--accent-group`
- Video badge (S:VID): `--accent-video`
- Image badge (S:IMG): `--accent-primary`
- Clip indicator: `--accent-video`
- Audio indicator: `--accent-audio`

### AssetDrawer

- Video type badge: `--accent-video`
- Audio type badge: `--accent-audio`
- Cut usage badge: `--accent-secondary`
- Cut usage thumbnail: `--accent-secondary`
- Audio usage badge: `--accent-audio`

### DetailsPanel

- Notes icon: `--accent-primary`
- Group info: `--accent-group`
- Multi-select stats: `--accent-group`
- Clip info section: `--accent-video`
- Attached audio section: `--accent-audio`
