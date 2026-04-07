import { signal, computed } from '@preact/signals';
import { PHASE, SONG_STATUS, DEFAULT_PREFERENCES } from '../../shared/constants.js';
import { MSG } from '../../shared/messages.js';

// --- Core state signals ---

export const phase = signal(PHASE.DETECT);
export const playlistName = signal('');
export const tracks = signal([]);
export const selectedTracks = signal(new Set());
export const queue = signal([]);
export const currentIndex = signal(-1);
export const preferences = signal({ ...DEFAULT_PREFERENCES });
export const error = signal(null);
export const showPreferences = signal(false);

// --- Computed ---

export const currentSong = computed(() => {
  const idx = currentIndex.value;
  const q = queue.value;
  if (idx >= 0 && idx < q.length) return q[idx];
  return null;
});

export const progress = computed(() => {
  const q = queue.value;
  return {
    total: q.length,
    done: q.filter((s) => s.status === SONG_STATUS.DONE).length,
    skipped: q.filter((s) => s.status === SONG_STATUS.SKIPPED).length,
    current: currentIndex.value,
  };
});

export const isComplete = computed(() => {
  const idx = currentIndex.value;
  const q = queue.value;
  return idx >= q.length && q.length > 0;
});

// --- Actions ---

async function sendMessage(msg) {
  try {
    return await chrome.runtime.sendMessage(msg);
  } catch (err) {
    error.value = err.message;
    return { error: err.message };
  }
}

export async function detectPlaylist() {
  error.value = null;
  const result = await sendMessage({ type: MSG.DETECT_PLAYLIST });
  if (result?.error) {
    error.value = result.error;
    return;
  }
  if (result?.tracks) {
    playlistName.value = result.playlistName;
    tracks.value = result.tracks;
    selectedTracks.value = new Set(result.tracks.map((_, i) => i));
    phase.value = PHASE.QUEUE;
  }
}

export function toggleTrack(index) {
  const newSet = new Set(selectedTracks.value);
  if (newSet.has(index)) {
    newSet.delete(index);
  } else {
    newSet.add(index);
  }
  selectedTracks.value = newSet;
}

export function selectAllTracks() {
  selectedTracks.value = new Set(tracks.value.map((_, i) => i));
}

export function deselectAllTracks() {
  selectedTracks.value = new Set();
}

export async function startProcessing() {
  const selected = tracks.value.filter((_, i) => selectedTracks.value.has(i));
  if (selected.length === 0) return;

  phase.value = PHASE.PROCESSING;
  error.value = null;

  const result = await sendMessage({
    type: MSG.START_PROCESSING,
    payload: {
      tracks: selected,
      playlistName: playlistName.value,
      preferences: preferences.value,
    },
  });

  if (result?.error) {
    error.value = result.error;
  }
}

export async function openSearch(source) {
  await sendMessage({ type: MSG.OPEN_SEARCH, payload: { source } });
}

export async function markDone() {
  await sendMessage({ type: MSG.MARK_DONE });
}

export async function skipSong() {
  await sendMessage({ type: MSG.SKIP_SONG });
}

export async function goBack() {
  await sendMessage({ type: MSG.GO_BACK });
}

export async function toggleStatus(index) {
  await sendMessage({ type: MSG.TOGGLE_STATUS, payload: { index } });
}

export async function goToSong(index) {
  await sendMessage({ type: MSG.GO_TO_SONG, payload: { index } });
}

export async function startProcessingTracks(trackList) {
  if (trackList.length === 0) return;
  phase.value = PHASE.PROCESSING;
  error.value = null;
  await sendMessage({
    type: MSG.START_PROCESSING,
    payload: {
      tracks: trackList,
      playlistName: playlistName.value,
      preferences: preferences.value,
    },
  });
}

export async function retrySong(index) {
  const song = queue.value[index];
  if (!song || song.status !== SONG_STATUS.SKIPPED) return;
  await startProcessingTracks([{ title: song.title, artist: song.artist }]);
}

export function updatePreference(key, value) {
  preferences.value = { ...preferences.value, [key]: value };
  chrome.storage.sync.set({ preferences: preferences.value });
}

// --- Listen for state updates from service worker ---

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MSG.STATE_UPDATE && message.payload) {
    const state = message.payload;
    queue.value = state.queue || [];
    currentIndex.value = state.currentIndex ?? -1;

    if (state.currentIndex >= state.queue?.length && state.queue?.length > 0) {
      phase.value = PHASE.COMPLETE;
    }
  }
});

// --- Load saved preferences on init ---

chrome.storage.sync.get('preferences', (result) => {
  if (result.preferences) {
    preferences.value = { ...DEFAULT_PREFERENCES, ...result.preferences };
  }
});
