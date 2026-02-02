# Bulk Import Button Design Proposals

## Current Issue
- Green button stands out in cool-toned UI
- Toolbar area should focus on filtering/sorting

## Design Proposals

---

### Option A: Floating Action Button (FAB) - Recommended

Position a circular button at the bottom-right corner of the asset panel.

```
+----------------------------------+
| Assets                        [X] |
+----------------------------------+
| [Search...]                       |
| [Sort v] [All] [Img] [Vid] [Aud]  |
+----------------------------------+
|                                   |
|   [asset] [asset] [asset]         |
|   [asset] [asset] [asset]         |
|   [asset] [asset] [asset]         |
|                                   |
|                           +-----+ |
|                           | [+] | |  <- FAB
|                           +-----+ |
+----------------------------------+
```

**Pros:**
- Clear separation from filter controls
- Common UI pattern (Material Design)
- Always visible while scrolling
- Expandable for future actions

**Style:**
```css
/* Neutral/subtle gradient matching UI */
background: linear-gradient(135deg, #334155, #475569);
/* OR primary cyan for emphasis */
background: var(--accent-primary);
```

---

### Option B: Header Icon Button

Small icon-only button next to the close button.

```
+----------------------------------+
| Assets              [+]       [X] |
+----------------------------------+
| [Search...]                       |
| [Sort v] [All] [Img] [Vid] [Aud]  |
+----------------------------------+
```

**Pros:**
- Minimal footprint
- Keeps toolbar clean

**Cons:**
- Less discoverable
- Might confuse with close button

---

### Option C: Empty State Integration

Show import prominently only when no assets exist.

```
+----------------------------------+
| Assets                        [X] |
+----------------------------------+
| [Search...]                       |
| [Sort v] [All] [Img] [Vid] [Aud]  |
+----------------------------------+
|                                   |
|        No assets in vault         |
|                                   |
|     +------------------------+    |
|     | [Folder] Import Folder |    |
|     +------------------------+    |
|                                   |
+----------------------------------+
```

When assets exist, show small FAB or header icon.

---

### Option D: Dropdown Menu

Add a "more actions" menu in the toolbar.

```
+----------------------------------+
| Assets                        [X] |
+----------------------------------+
| [Search...]                       |
| [Sort v] [All][Img][Vid][Aud] [⋮] |
+----------------------------------+        +------------------+
                                           | Import Folder... |
                                           | Refresh          |
                                           +------------------+
```

**Pros:**
- Scalable for future actions
- Keeps UI clean

**Cons:**
- Extra click required
- Less discoverable

---

## Color Recommendations

Instead of green (`--accent-success`), use:

| Option | Color | Variable | Use Case |
|--------|-------|----------|----------|
| Neutral | Slate gradient | `#334155 → #475569` | Subtle, professional |
| Primary | Cyan | `--accent-primary` | Matches selection/notes |
| Secondary | Blue | `--accent-secondary` | Matches usage indicators |

---

## Recommendation

**Option A (FAB) with neutral/cyan color** is the best fit:

1. Keeps toolbar focused on filtering
2. Always accessible
3. Common pattern users understand
4. Expandable (could add "refresh" etc. in future)
5. Fits the cool color scheme

Implementation:
- Position: `bottom: 16px; right: 16px;`
- Size: 44px circle
- Icon: `FolderPlus` or `Plus`
- Color: Neutral slate or `--accent-primary`
