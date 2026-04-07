import { MSG } from '../shared/messages.js';
import { QueueManager } from './queue-manager.js';

const queueManager = new QueueManager();

// --- Side Panel Setup ---

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// --- Keepalive ---
// MV3 service workers go inactive after ~30s. Keep alive while processing.

function startKeepalive() {
  chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
}

function stopKeepalive() {
  chrome.alarms.clear('keepalive');
}

chrome.alarms.onAlarm.addListener(() => {
  // no-op — just keeps the worker alive
});

// --- Broadcast state to side panel ---

function broadcastToSidePanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel may not be open — that's fine
  });
}

function onStateChange(state) {
  broadcastToSidePanel({ type: MSG.STATE_UPDATE, payload: state });
}

queueManager.onStateChange = onStateChange;

// --- Restore state on service worker restart ---

async function ensureRestored() {
  if (queueManager.queue.length === 0) {
    await queueManager.restore(onStateChange);
  }
}

// --- Message Handler ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((err) => {
    sendResponse({ error: err.message });
  });
  return true;
});

async function handleMessage(message, sender) {
  // Restore state if the service worker restarted
  await ensureRestored();

  switch (message.type) {
    case MSG.DETECT_PLAYLIST:
      return await detectPlaylist();

    case MSG.START_PROCESSING:
      startKeepalive();
      return startProcessing(message.payload);

    case MSG.OPEN_SEARCH:
      await queueManager.openSearch(message.payload.source);
      return { ok: true };

    case MSG.MARK_DONE:
      queueManager.markDone();
      if (!queueManager.isActive()) stopKeepalive();
      return { ok: true };

    case MSG.SKIP_SONG:
      queueManager.skipSong();
      if (!queueManager.isActive()) stopKeepalive();
      return { ok: true };

    case MSG.GO_BACK:
      queueManager.goBack();
      return { ok: true };

    case MSG.GO_TO_SONG:
      queueManager.goToSong(message.payload.index);
      startKeepalive();
      return { ok: true };

    case MSG.TOGGLE_STATUS:
      queueManager.toggleStatus(message.payload.index);
      return { ok: true };

    case 'playlist_result':
      if (_extractorResolve) {
        _extractorResolve(message.payload);
        _extractorResolve = null;
      }
      return { ok: true };

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}

// --- Detect Playlist ---

const PLATFORM_PATTERNS = [
  { url: 'https://open.spotify.com/*', script: 'spotify-extractor.js', name: 'Spotify' },
  { url: 'https://music.apple.com/*', script: 'apple-music-extractor.js', name: 'Apple Music' },
  { url: 'https://music.youtube.com/*', script: 'youtube-music-extractor.js', name: 'YouTube Music' },
  { url: 'https://www.youtube.com/*', script: 'youtube-extractor.js', name: 'YouTube' },
  { url: 'https://listen.tidal.com/*', script: 'tidal-extractor.js', name: 'Tidal' },
  { url: 'https://tidal.com/*', script: 'tidal-extractor.js', name: 'Tidal' },
];

async function detectPlaylist() {
  // First check the active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (activeTab) {
    for (const platform of PLATFORM_PATTERNS) {
      if (matchesPattern(activeTab.url, platform.url)) {
        return await injectExtractor(activeTab.id, platform.script);
      }
    }
  }

  // Fall back to searching all tabs for any supported platform
  for (const platform of PLATFORM_PATTERNS) {
    const tabs = await chrome.tabs.query({ url: platform.url });
    if (tabs.length > 0) {
      return await injectExtractor(tabs[0].id, platform.script);
    }
  }

  const supported = [...new Set(PLATFORM_PATTERNS.map((p) => p.name))].join(', ');
  return { error: `No supported music tab found. Open a playlist on: ${supported}` };
}

function matchesPattern(url, pattern) {
  if (!url) return false;
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(url);
}

let _extractorResolve = null;

async function injectExtractor(tabId, scriptFile) {
  try {
    const resultPromise = new Promise((resolve) => {
      _extractorResolve = resolve;
      setTimeout(() => {
        if (_extractorResolve === resolve) {
          _extractorResolve = null;
          resolve(null);
        }
      }, 30000);
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [scriptFile],
    });

    const data = await resultPromise;
    if (!data || !data.tracks || data.tracks.length === 0) {
      return { error: 'Could not detect any tracks. Make sure a playlist is open.' };
    }
    return data;
  } catch (err) {
    _extractorResolve = null;
    return { error: `Failed to read page: ${err.message}` };
  }
}

// --- Start Processing ---

function startProcessing({ tracks, playlistName, preferences }) {
  queueManager.init({
    tracks,
    playlistName,
    preferences,
    onStateChange,
  });
  return { ok: true };
}
