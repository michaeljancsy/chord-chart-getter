import { MSG } from '../shared/messages.js';
import { QueueManager } from './queue-manager.js';

const queueManager = new QueueManager();

// --- Side Panel Setup ---

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// --- Keepalive for MV3 service worker ---

function startKeepalive() {
  chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
}

function stopKeepalive() {
  chrome.alarms.clear('keepalive');
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    // no-op — keeps the worker alive
  }
});

// --- Broadcast state to side panel ---

function broadcastToSidePanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel may not be open — that's fine
  });
}

queueManager.onStateChange = (state) => {
  broadcastToSidePanel({ type: MSG.STATE_UPDATE, payload: state });
};

// --- Message Handler ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((err) => {
    sendResponse({ error: err.message });
  });
  return true; // keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case MSG.DETECT_PLAYLIST:
      return await detectPlaylist();

    case MSG.START_PROCESSING:
      return await startProcessing(message.payload);

    case MSG.SELECT_RESULT:
      await queueManager.selectResult(message.payload);
      return { ok: true };

    case MSG.CONFIRM_SAVE:
      await queueManager.confirmSave(message.payload?.downloadChoice);
      return { ok: true };

    case MSG.SKIP_SONG:
      queueManager.skipSong();
      return { ok: true };

    case MSG.TRY_ANOTHER:
      queueManager.tryAnother();
      return { ok: true };

    case MSG.PAUSE_PROCESSING:
      queueManager.pause();
      stopKeepalive();
      return { ok: true };

    case MSG.RESUME_PROCESSING:
      queueManager.resume();
      startKeepalive();
      return { ok: true };

    // Content scripts send their extraction results via this message type
    case 'extractor_result':
      queueManager.handleExtractorResult(message);
      return { ok: true };

    case 'spotify_playlist_result':
      if (_spotifyResolve) {
        _spotifyResolve(message.payload);
        _spotifyResolve = null;
      }
      return { ok: true };

    case 'ug_print_result':
      queueManager.handlePrintResult(message);
      return { ok: true };

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}

// --- Detect Playlist ---

async function detectPlaylist() {
  // Find the active Spotify tab
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
    url: 'https://open.spotify.com/*',
  });

  if (!tab) {
    // Try any Spotify tab
    const tabs = await chrome.tabs.query({ url: 'https://open.spotify.com/*' });
    if (tabs.length === 0) {
      return { error: 'No Spotify tab found. Please open a playlist on open.spotify.com.' };
    }
    return await injectSpotifyExtractor(tabs[0].id);
  }

  return await injectSpotifyExtractor(tab.id);
}

// Pending resolver for Spotify playlist extraction
let _spotifyResolve = null;

async function injectSpotifyExtractor(tabId) {
  try {
    // Set up a promise that resolves when the content script sends its result
    const resultPromise = new Promise((resolve) => {
      _spotifyResolve = resolve;
      setTimeout(() => {
        if (_spotifyResolve === resolve) {
          _spotifyResolve = null;
          resolve(null);
        }
      }, 30000); // 30s timeout for large playlists with scrolling
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['spotify-extractor.js'],
    });

    const data = await resultPromise;
    if (!data || !data.tracks || data.tracks.length === 0) {
      return { error: 'Could not detect any tracks. Make sure a playlist is open.' };
    }
    return data;
  } catch (err) {
    _spotifyResolve = null;
    return { error: `Failed to read Spotify page: ${err.message}` };
  }
}

// --- Start Processing ---

async function startProcessing({ tracks, playlistName, preferences }) {
  startKeepalive();
  queueManager.init({
    tracks,
    playlistName,
    preferences,
    onStateChange: (state) => {
      broadcastToSidePanel({ type: MSG.STATE_UPDATE, payload: state });
    },
  });
  queueManager.processNext();
  return { ok: true };
}
