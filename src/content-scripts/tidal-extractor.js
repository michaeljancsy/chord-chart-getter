// Content script injected into tidal.com to extract playlist tracks.
// Tidal uses virtual scrolling — only ~11 rows exist in DOM at a time.
// Must scroll through the main element incrementally to collect all tracks.

(async () => {
  const SCROLL_DELAY = 500;
  const MAX_SCROLL_ATTEMPTS = 200;

  function getPlaylistName() {
    return (
      document.querySelector('h1')?.textContent?.trim() ||
      'Unknown Playlist'
    );
  }

  function getExpectedTrackCount() {
    const text = document.body.innerText;
    const match = text.match(/(\d+)\s+tracks?/i);
    return match ? parseInt(match[1], 10) : null;
  }

  function extractVisibleTracks() {
    const tracks = [];
    const rows = document.querySelectorAll('[data-test="tracklist-row"]');

    for (const row of rows) {
      const titleEl = row.querySelector('[data-test="table-cell-title"]');
      const title = titleEl?.textContent?.trim();

      const artistEl = row.querySelector('[data-test="track-row-artist"]');
      const artist = artistEl?.textContent?.trim() || '';

      if (title) {
        tracks.push({ title, artist });
      }
    }

    return tracks;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const seen = new Map();
  const scrollContainer = document.querySelector('main') || document.documentElement;
  const playlistName = getPlaylistName();
  const expectedCount = getExpectedTrackCount();

  // Scroll to top first
  scrollContainer.scrollTo(0, 0);
  await sleep(SCROLL_DELAY);

  let scrollAttempts = 0;
  let lastSeenCount = 0;
  let noNewTracksCount = 0;

  while (scrollAttempts < MAX_SCROLL_ATTEMPTS) {
    const visible = extractVisibleTracks();
    for (const track of visible) {
      const key = `${track.title}|||${track.artist}`;
      if (!seen.has(key)) {
        seen.set(key, track);
      }
    }

    if (expectedCount && seen.size >= expectedCount) {
      break;
    }

    if (seen.size === lastSeenCount) {
      noNewTracksCount++;
      if (noNewTracksCount >= 5) break;
    } else {
      noNewTracksCount = 0;
      lastSeenCount = seen.size;
    }

    scrollContainer.scrollBy({ top: 300, behavior: 'smooth' });
    await sleep(SCROLL_DELAY);
    scrollAttempts++;
  }

  const result = {
    playlistName,
    expectedCount,
    tracks: Array.from(seen.values()),
  };

  chrome.runtime.sendMessage({ type: 'playlist_result', payload: result });
})();
