# Playlists-to-Chord-Charts

Chrome extension (Manifest V3) that extracts playlists from music streaming services and helps the user step through each song to find chord charts, tabs, and sheet music.

## Architecture

- **Preact + Vite** — side panel UI with JSX components and `@preact/signals` for state
- **Side panel** (not popup) — stays open while user navigates between tabs
- **Service worker** — central orchestrator, manages queue state and tab navigation
- **Content scripts** — injected on-demand to extract playlist data from music services
- **Message-based communication** — content scripts send results via `chrome.runtime.sendMessage`

## Supported Platforms

### Playlist sources
- Spotify (`open.spotify.com`)
- Apple Music (`music.apple.com`)
- YouTube Music (`music.youtube.com`)
- YouTube (`www.youtube.com`)
- Tidal (`tidal.com`, `listen.tidal.com`)

### Chart search providers
- Ultimate Guitar, Chordify, Songsterr, Musescore, Sheet Music Direct, YouTube

## Key Design Decisions

### Manual workflow
- The extension does NOT automate downloads or scrape chart content
- It provides convenient search buttons that open chart sites in a browser tab
- The user marks each song Done or Skip manually
- Users can click any song in the queue to jump to it, and toggle Done/Skipped status

### Service worker lifecycle (MV3)
- MV3 service workers go inactive after ~30s of inactivity
- Keepalive alarm (`chrome.alarms`) runs during active processing
- State is persisted to `chrome.storage.local` and restored on service worker restart via `ensureRestored()`

### Virtual scroll handling
- Spotify and Tidal use virtual scrolling — only a subset of tracks exist in the DOM at any time
- Extractors scroll incrementally and collect tracks at each position
- Extractors check for expected track count and stop when all tracks are found

## Build

```sh
npm run build    # production build to dist/
npm run dev      # watch mode
npm test         # run tests (Vitest + jsdom)
```

Load `dist/` as unpacked extension in `chrome://extensions`.

## File Structure

- `src/background/` — service worker, queue manager
- `src/content-scripts/` — playlist extractors (Spotify, Apple Music, YouTube, YouTube Music, Tidal), UG extractor/parser, Chordify/Songsterr extractors, UG print trigger
- `src/sidepanel/` — Preact UI (components, store, styles)
- `src/shared/` — constants, message types
- `test/` — Vitest unit tests with Chrome API mocks
- `manifest.json` — extension manifest (copied to dist by Vite plugin)
- `assets/icons/` — extension icons
- `assets/screenshots/` — README screenshots

## Notes

- Node is at `/opt/homebrew/bin` (not on default PATH in some shells)
- The `dist/` side panel HTML lives at `dist/src/sidepanel/index.html` with relative `../../` paths to JS/CSS at the dist root
- DOM selectors in extractors may need updating as music services change their markup
