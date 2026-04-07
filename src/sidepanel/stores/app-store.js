import { signal, computed } from '@preact/signals';
import { PHASE, SONG_STATUS, DEFAULT_PREFERENCES } from '../../shared/constants.js';
import { MSG } from '../../shared/messages.js';

// --- Core state signals ---

export const phase = signal(PHASE.DETECT);
export const playlistName = signal('');
export const tracks = signal([]);
export const selectedTracks = signal(new Set()); // indices of selected tracks
export const queue = signal([]);
export const currentIndex = signal(-1);
export const paused = signal(false);
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
    saved: q.filter((s) => s.status === SONG_STATUS.SAVED).length,
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

export async function selectResult(resultData) {
  await sendMessage({ type: MSG.SELECT_RESULT, payload: resultData });
}

export async function confirmSave(downloadChoice) {
  await sendMessage({ type: MSG.CONFIRM_SAVE, payload: { downloadChoice } });
}

export async function skipSong() {
  await sendMessage({ type: MSG.SKIP_SONG });
}

export async function tryAnother() {
  await sendMessage({ type: MSG.TRY_ANOTHER });
}

export async function pauseProcessing() {
  await sendMessage({ type: MSG.PAUSE_PROCESSING });
}

export async function resumeProcessing() {
  await sendMessage({ type: MSG.RESUME_PROCESSING });
}

export function updatePreference(key, value) {
  preferences.value = { ...preferences.value, [key]: value };
  // Persist preferences
  chrome.storage.sync.set({ preferences: preferences.value });
}

// --- Listen for state updates from service worker ---

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MSG.STATE_UPDATE && message.payload) {
    const state = message.payload;
    queue.value = state.queue || [];
    currentIndex.value = state.currentIndex ?? -1;
    paused.value = state.paused ?? false;

    // Auto-detect completion
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
