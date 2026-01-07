# AI Scene Deck

A visual asset management and timeline editing application for AI-generated content. Organize your images and videos in a solitaire-style interface, create scene compositions, and preview them as slideshows.

## Features

### Asset Management (Obsidian-like)
- Local folder synchronization - reads your existing folder structure
- Asset cataloging for images and videos
- Drag & drop assets to timeline
- Favorites system for quick access

### Scene/Cut Editing (Solitaire Interface)
- Multi-column layout with Scenes on horizontal axis
- Cuts stacked vertically as draggable cards
- Display time settings per cut
- Mix images and videos in the same timeline

### Preview Features
- Scene-specific slideshow preview
- Full timeline preview (all scenes)
- Keyboard controls (Space, Arrow keys, F for fullscreen)
- Progress indicator with timing display

### Extensibility (Future)
- AI editing integration slots (Remix Image, AI Inpaint)
- API slots for image/video generation integration
- Export to video format (planned)

## Tech Stack

- **Electron** - Desktop application framework
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Zustand** - State management
- **dnd-kit** - Drag and drop functionality
- **Vite** - Build tool
- **Lucide React** - Icons

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Build Electron main process
npm run build:electron

# Run in development mode
npm run dev
```

### Development Commands

```bash
# Start development server (renderer only)
npm run dev:renderer

# Start Electron in development
npm run dev:main

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
AI-Scene-Deck/
├── electron/           # Electron main process
│   ├── main.ts        # Main process entry
│   └── preload.ts     # Preload script for IPC
├── src/
│   ├── components/    # React components
│   ├── store/         # Zustand store
│   ├── styles/        # CSS files
│   ├── types/         # TypeScript types
│   └── utils/         # Utility functions
├── index.html
├── package.json
└── vite.config.ts
```

## Usage

1. **Select a Folder**: Click "Select Folder" in the sidebar to choose your asset directory
2. **Browse Assets**: Navigate the folder tree and preview thumbnails
3. **Add to Timeline**: Drag assets to scene columns or double-click to add
4. **Organize**: Drag cards between scenes and reorder within scenes
5. **Configure**: Select a cut to adjust display time in the Details panel
6. **Preview**: Click the play button to watch your slideshow

## Keyboard Shortcuts (Preview Mode)

- `Space` - Play/Pause
- `←` / `→` - Previous/Next cut
- `F` - Toggle fullscreen
- `Esc` - Close preview

## License

MIT
