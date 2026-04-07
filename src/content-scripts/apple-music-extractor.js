// Content script injected into music.apple.com to extract playlist tracks.

(async () => {
  const SCROLL_DELAY = 500;
  const MAX_SCROLL_ATTEMPTS = 200;

  function getPlaylistName() {
    return (
      document.querySelector('.headings__title')?.textContent?.trim() ||
      document.querySelector('[data-testid="non-editable-product-title"]')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      'Unknown Playlist'
    );
  }

  function extractVisibleTracks() {
    const tracks = [];
    const rows = document.querySelectorAll('.songs-list-row, [data-testid="track-row"], .tracklist-item');

    for (const row of rows) {
      const titleEl =
        row.querySelector('.songs-list-row__song-name, .tracklist-item__text__headline') ||
        row.querySelector('[data-testid="track-title"]') ||
        row.querySelector('.song-name');
      const title = titleEl?.textContent?.trim();

      const artistEl =
        row.querySelector('.songs-list-row__by-line a, .tracklist-item__text__subtitle a') ||
        row.querySelector('[data-testid="track-artist"]') ||
        row.querySelector('.by-line a');
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
  const scrollContainer = document.querySelector('.scrollable-page') || document.documentElement;
  const playlistName = getPlaylistName();

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

    if (seen.size === lastSeenCount) {
      noNewTracksCount++;
      if (noNewTracksCount >= 5) break;
    } else {
      noNewTracksCount = 0;
      lastSeenCount = seen.size;
    }

    scrollContainer.scrollBy({ top: 600, behavior: 'smooth' });
    await sleep(SCROLL_DELAY);
    scrollAttempts++;
  }

  const result = {
    playlistName,
    tracks: Array.from(seen.values()),
  };

  chrome.runtime.sendMessage({ type: 'playlist_result', payload: result });
})();
