import { SONG_STATUS, SEARCH_URLS } from '../shared/constants.js';

export class QueueManager {
  constructor() {
    this.queue = [];
    this.currentIndex = -1;
    this.playlistName = '';
    this.preferences = {};
    this.onStateChange = null;
    this._chartTabId = null;
  }

  // ── state helpers ──────────────────────────────────────────────

  init({ tracks, playlistName, preferences, onStateChange }) {
    this.queue = tracks.map((track) => ({
      ...track,
      status: SONG_STATUS.PENDING,
    }));
    this.currentIndex = 0;
    this.playlistName = playlistName;
    this.preferences = preferences;
    this.onStateChange = onStateChange;

    if (this.queue.length > 0) {
      this.queue[0].status = SONG_STATUS.ACTIVE;
    }
    this.broadcastState();
  }

  /**
   * Restore state from chrome.storage.local after service worker restart.
   */
  async restore(onStateChange) {
    const { queueState } = await chrome.storage.local.get('queueState');
    if (!queueState || !queueState.queue || queueState.queue.length === 0) return false;

    this.queue = queueState.queue;
    this.currentIndex = queueState.currentIndex;
    this.playlistName = queueState.playlistName;
    this.preferences = queueState.preferences || {};
    this.onStateChange = onStateChange;
    return true;
  }

  isActive() {
    return this.queue.length > 0 && this.currentIndex < this.queue.length;
  }

  getState() {
    return {
      queue: this.queue,
      currentIndex: this.currentIndex,
      playlistName: this.playlistName,
      preferences: this.preferences,
      progress: {
        total: this.queue.length,
        done: this.queue.filter((s) => s.status === SONG_STATUS.DONE).length,
        skipped: this.queue.filter((s) => s.status === SONG_STATUS.SKIPPED).length,
        current: this.currentIndex,
      },
    };
  }

  broadcastState() {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
    chrome.storage.local.set({ queueState: this.getState() });
  }

  // ── navigation ─────────────────────────────────────────────────

  async openSearch(source) {
    const song = this.queue[this.currentIndex];
    if (!song) return;

    const query = `${song.artist.replace(/,/g, '')} ${song.title}`;
    const url = SEARCH_URLS[source](query);

    if (this._chartTabId) {
      try {
        await chrome.tabs.get(this._chartTabId);
        await chrome.tabs.update(this._chartTabId, { url, active: true });
        return;
      } catch {
        this._chartTabId = null;
      }
    }

    const tab = await chrome.tabs.create({ url, active: true });
    this._chartTabId = tab.id;
  }

  // ── user actions ───────────────────────────────────────────────

  markDone() {
    if (!this.isActive()) return;
    this.queue[this.currentIndex].status = SONG_STATUS.DONE;
    this._advance();
  }

  skipSong() {
    if (!this.isActive()) return;
    this.queue[this.currentIndex].status = SONG_STATUS.SKIPPED;
    this._advance();
  }

  goBack() {
    if (this.currentIndex <= 0) return;
    // Revert current song to PENDING if it's ACTIVE
    if (this.isActive()) {
      this.queue[this.currentIndex].status = SONG_STATUS.PENDING;
    }
    this.currentIndex--;
    this.queue[this.currentIndex].status = SONG_STATUS.ACTIVE;
    this.broadcastState();
  }

  goToSong(index) {
    if (index < 0 || index >= this.queue.length) return;
    if (index === this.currentIndex) return;

    // Revert current song to PENDING if it's ACTIVE
    if (this.isActive() && this.queue[this.currentIndex].status === SONG_STATUS.ACTIVE) {
      this.queue[this.currentIndex].status = SONG_STATUS.PENDING;
    }

    // If target song is DONE or SKIPPED, revert it to ACTIVE
    this.queue[index].status = SONG_STATUS.ACTIVE;
    this.currentIndex = index;
    this.broadcastState();
  }

  toggleStatus(index) {
    const song = this.queue[index];
    if (!song) return;
    if (song.status === SONG_STATUS.DONE) {
      song.status = SONG_STATUS.SKIPPED;
    } else if (song.status === SONG_STATUS.SKIPPED) {
      song.status = SONG_STATUS.DONE;
    }
    this.broadcastState();
  }

  _advance() {
    this.currentIndex++;
    if (this.currentIndex < this.queue.length) {
      this.queue[this.currentIndex].status = SONG_STATUS.ACTIVE;
    }
    this.broadcastState();
  }
}
