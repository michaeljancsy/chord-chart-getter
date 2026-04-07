# Chord Chart Getter

Chrome extension (Manifest V3) that takes a Spotify playlist and helps the user serially find and download chord charts/tabs/sheet music from Ultimate Guitar, Chordify, and Songsterr.

## Architecture

- **Preact + Vite** — side panel UI with JSX components
- **Side panel** (not popup) — stays open while user navigates between tabs
- **Service worker** — central orchestrator, manages tab navigation and queue
- **Content scripts** — injected on-demand into chart sites to read the DOM
- **Message-based communication** — content scripts send results via `chrome.runtime.sendMessage` (not `executeScript` return values, which are unreliable with `files` option)

## Key Design Decisions

### Anti-bot strategy (critically important)
- ALL chart site interaction happens via real browser tab navigation (`chrome.tabs.update`), never background `fetch`/`XHR`
- Content scripts only READ the DOM, never click/fill/mutate (exception: UG print button)
- Human-like random delays between all actions
- Single tab reuse, sequential processing only

### UG PDF download
- For chord charts: UG's print button opens a new tab with a rendered PDF — detect and download it
- For tabs: UG's print button opens a print dialog
- User chooses Tab / Chords / Both before saving

### Tab reload detection
- The chart tab may reload unexpectedly (redirects, cookie walls, anti-bot)
- `_tabReloadListener` watches for `complete` events not initiated by `navigateAndWait`
- Re-injects the appropriate extractor when a reload is detected

## Build

```sh
npm run build    # production build to dist/
npm run dev      # watch mode
```

Load `dist/` as unpacked extension in `chrome://extensions`.

## File Structure

- `src/background/` — service worker, queue manager, download manager, delay utils
- `src/content-scripts/` — extractors for Spotify, UG, Chordify, Songsterr + UG print trigger
- `src/sidepanel/` — Preact UI (components, store, styles)
- `src/shared/` — constants, message types, formatters
- `manifest.json` — extension manifest (copied to dist by Vite plugin)
- `assets/icons/` — placeholder extension icons

## Notes

- Node is at `/opt/homebrew/bin` (not on default PATH in some shells)
- UG DOM selectors may need updating — the `.js-store` approach has a DOM fallback
- The `dist/` side panel HTML lives at `dist/src/sidepanel/index.html` with relative `../../` paths to JS/CSS at the dist root
