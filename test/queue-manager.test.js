import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createChromeMock } from './chrome-mock.js';
import { SONG_STATUS, SOURCES, SEARCH_URLS } from '../src/shared/constants.js';
import { QueueManager } from '../src/background/queue-manager.js';

function makeTracks(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    title: `Song ${i + 1}`,
    artist: `Artist ${i + 1}`,
  }));
}

describe('QueueManager', () => {
  let qm;
  let chromeMock;
  let onStateChange;

  beforeEach(() => {
    ({ chrome: chromeMock } = createChromeMock());
    globalThis.chrome = chromeMock;
    qm = new QueueManager();
    onStateChange = vi.fn();
  });

  afterEach(() => {
    delete globalThis.chrome;
  });

  function init(overrides = {}) {
    qm.init({
      tracks: overrides.tracks || makeTracks(),
      playlistName: overrides.playlistName || 'Test Playlist',
      preferences: { sources: [SOURCES.ULTIMATE_GUITAR], ...overrides.preferences },
      onStateChange,
    });
  }

  // ── init ──────────────────────────────────────────────────

  describe('init', () => {
    it('sets first song to ACTIVE, rest to PENDING', () => {
      init();
      expect(qm.queue[0].status).toBe(SONG_STATUS.ACTIVE);
      expect(qm.queue[1].status).toBe(SONG_STATUS.PENDING);
      expect(qm.queue[2].status).toBe(SONG_STATUS.PENDING);
    });

    it('sets currentIndex to 0', () => {
      init();
      expect(qm.currentIndex).toBe(0);
    });

    it('broadcasts state on init', () => {
      init();
      expect(onStateChange).toHaveBeenCalled();
    });

    it('handles empty track list', () => {
      init({ tracks: [] });
      expect(qm.queue).toHaveLength(0);
      expect(qm.currentIndex).toBe(0);
    });
  });

  // ── getState ──────────────────────────────────────────────

  describe('getState', () => {
    it('returns progress counts', () => {
      init();
      qm.queue[0].status = SONG_STATUS.DONE;
      qm.queue[1].status = SONG_STATUS.SKIPPED;

      const state = qm.getState();
      expect(state.progress.total).toBe(3);
      expect(state.progress.done).toBe(1);
      expect(state.progress.skipped).toBe(1);
    });

    it('includes playlistName', () => {
      init({ playlistName: 'My Jams' });
      expect(qm.getState().playlistName).toBe('My Jams');
    });
  });

  // ── markDone ──────────────────────────────────────────────

  describe('markDone', () => {
    it('marks current song DONE and advances to next', () => {
      init();
      qm.markDone();

      expect(qm.queue[0].status).toBe(SONG_STATUS.DONE);
      expect(qm.queue[1].status).toBe(SONG_STATUS.ACTIVE);
      expect(qm.currentIndex).toBe(1);
    });

    it('broadcasts state after marking done', () => {
      init();
      onStateChange.mockClear();
      qm.markDone();
      expect(onStateChange).toHaveBeenCalled();
    });

    it('handles last song in queue', () => {
      init({ tracks: makeTracks(1) });
      qm.markDone();

      expect(qm.queue[0].status).toBe(SONG_STATUS.DONE);
      expect(qm.currentIndex).toBe(1); // past end → triggers completion
    });
  });

  // ── skipSong ──────────────────────────────────────────────

  describe('skipSong', () => {
    it('marks current song SKIPPED and advances', () => {
      init();
      qm.skipSong();

      expect(qm.queue[0].status).toBe(SONG_STATUS.SKIPPED);
      expect(qm.queue[1].status).toBe(SONG_STATUS.ACTIVE);
      expect(qm.currentIndex).toBe(1);
    });
  });

  // ── goBack ─────────────────────────────────────────────────

  describe('goBack', () => {
    it('goes back to the previous song', () => {
      init();
      qm.markDone(); // advance to song 1
      expect(qm.currentIndex).toBe(1);

      qm.goBack();
      expect(qm.currentIndex).toBe(0);
      expect(qm.queue[0].status).toBe(SONG_STATUS.ACTIVE);
      expect(qm.queue[1].status).toBe(SONG_STATUS.PENDING);
    });

    it('does nothing at the first song', () => {
      init();
      qm.goBack();
      expect(qm.currentIndex).toBe(0);
      expect(qm.queue[0].status).toBe(SONG_STATUS.ACTIVE);
    });

    it('works from the results view (past end of queue)', () => {
      init({ tracks: makeTracks(1) });
      qm.markDone(); // past end
      expect(qm.currentIndex).toBe(1);

      qm.goBack();
      expect(qm.currentIndex).toBe(0);
      expect(qm.queue[0].status).toBe(SONG_STATUS.ACTIVE);
    });
  });

  // ── toggleStatus ──────────────────────────────────────────

  describe('toggleStatus', () => {
    it('toggles DONE to SKIPPED', () => {
      init();
      qm.queue[0].status = SONG_STATUS.DONE;
      qm.toggleStatus(0);
      expect(qm.queue[0].status).toBe(SONG_STATUS.SKIPPED);
    });

    it('toggles SKIPPED to DONE', () => {
      init();
      qm.queue[0].status = SONG_STATUS.SKIPPED;
      qm.toggleStatus(0);
      expect(qm.queue[0].status).toBe(SONG_STATUS.DONE);
    });

    it('does nothing for PENDING or ACTIVE songs', () => {
      init();
      qm.toggleStatus(0); // ACTIVE
      expect(qm.queue[0].status).toBe(SONG_STATUS.ACTIVE);

      qm.toggleStatus(1); // PENDING
      expect(qm.queue[1].status).toBe(SONG_STATUS.PENDING);
    });

    it('does nothing for invalid index', () => {
      init();
      qm.toggleStatus(99); // no crash
    });
  });

  // ── goToSong ─────────────────────────────────────────────

  describe('goToSong', () => {
    it('jumps forward to a pending song', () => {
      init();
      qm.goToSong(2);

      expect(qm.currentIndex).toBe(2);
      expect(qm.queue[0].status).toBe(SONG_STATUS.PENDING);
      expect(qm.queue[2].status).toBe(SONG_STATUS.ACTIVE);
    });

    it('jumps back to a completed song', () => {
      init();
      qm.markDone(); // song 0 → DONE
      qm.markDone(); // song 1 → DONE
      expect(qm.currentIndex).toBe(2);

      qm.goToSong(0);
      expect(qm.currentIndex).toBe(0);
      expect(qm.queue[0].status).toBe(SONG_STATUS.ACTIVE);
      expect(qm.queue[2].status).toBe(SONG_STATUS.PENDING);
    });

    it('does nothing for the current index', () => {
      init();
      onStateChange.mockClear();
      qm.goToSong(0);
      expect(onStateChange).not.toHaveBeenCalled();
    });

    it('does nothing for out-of-bounds index', () => {
      init();
      onStateChange.mockClear();
      qm.goToSong(99);
      expect(onStateChange).not.toHaveBeenCalled();
      qm.goToSong(-1);
      expect(onStateChange).not.toHaveBeenCalled();
    });

    it('works from past end of queue (results view)', () => {
      init({ tracks: makeTracks(2) });
      qm.markDone();
      qm.markDone();
      expect(qm.currentIndex).toBe(2); // past end

      qm.goToSong(0);
      expect(qm.currentIndex).toBe(0);
      expect(qm.queue[0].status).toBe(SONG_STATUS.ACTIVE);
    });
  });

  // ── sequential flow ───────────────────────────────────────

  describe('sequential flow', () => {
    it('processes all songs through done/skip', () => {
      init();
      qm.markDone();  // song 0 → DONE
      qm.skipSong();  // song 1 → SKIPPED
      qm.markDone();  // song 2 → DONE

      expect(qm.queue[0].status).toBe(SONG_STATUS.DONE);
      expect(qm.queue[1].status).toBe(SONG_STATUS.SKIPPED);
      expect(qm.queue[2].status).toBe(SONG_STATUS.DONE);
      expect(qm.currentIndex).toBe(3); // past end
    });
  });

  // ── openSearch ────────────────────────────────────────────

  describe('openSearch', () => {
    it('creates a new tab with the search URL', async () => {
      init();
      await qm.openSearch(SOURCES.ULTIMATE_GUITAR);

      expect(chromeMock.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('ultimate-guitar.com/search.php'),
          active: true,
        })
      );
    });

    it('reuses existing chart tab', async () => {
      init();
      await qm.openSearch(SOURCES.ULTIMATE_GUITAR);
      const tabId = qm._chartTabId;

      await qm.openSearch(SOURCES.CHORDIFY);

      expect(chromeMock.tabs.update).toHaveBeenCalledWith(
        tabId,
        expect.objectContaining({
          url: expect.stringContaining('chordify.net/search'),
          active: true,
        })
      );
    });

    it('includes artist and title in search query', async () => {
      init();
      await qm.openSearch(SOURCES.ULTIMATE_GUITAR);

      const createCall = chromeMock.tabs.create.mock.calls[0][0];
      expect(createCall.url).toContain('Artist%201');
      expect(createCall.url).toContain('Song%201');
    });

    it('strips commas from artist name in search query', async () => {
      init({ tracks: [{ title: 'September', artist: 'Earth, Wind, & Fire' }] });
      await qm.openSearch(SOURCES.ULTIMATE_GUITAR);

      const createCall = chromeMock.tabs.create.mock.calls[0][0];
      expect(createCall.url).toContain('Earth%20Wind%20%26%20Fire');
      expect(createCall.url).not.toContain(',');
    });

    it('creates new tab if previous tab was closed', async () => {
      init();
      await qm.openSearch(SOURCES.ULTIMATE_GUITAR);

      // Simulate tab being closed
      chromeMock.tabs.get.mockRejectedValueOnce(new Error('No tab'));

      await qm.openSearch(SOURCES.CHORDIFY);
      expect(chromeMock.tabs.create).toHaveBeenCalledTimes(2);
    });
  });
});
