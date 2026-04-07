// Content script injected into open.spotify.com to extract playlist tracks.
// Handles Spotify's virtual scrolling by scrolling through the playlist.

(async () => {
  const SCROLL_DELAY = 500;
  const MAX_SCROLL_ATTEMPTS = 200;

  function getPlaylistName() {
    return (
      document.querySelector('[data-testid="entityTitle"] h1')?.textContent?.trim() ||
      document.querySelector('[data-testid="entityTitle"]')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      'Unknown Playlist'
    );
  }

  function getExpectedTrackCount() {
    const metaText =
      document.querySelector('[data-testid="playlist-page"] [data-testid="subtitle"]')?.textContent ||
      document.querySelector('[data-testid="entitySubtitle"]')?.textContent ||
      '';
    const match = metaText.match(/(\d+)\s+songs?/i);
    return match ? parseInt(match[1], 10) : null;
  }

  function extractVisibleTracks() {
    const rows = document.querySelectorAll('[data-testid="tracklist-row"]');
    const tracks = [];

    for (const row of rows) {
      const titleEl =
        row.querySelector('[data-testid="internal-track-link"] div') ||
        row.querySelector('[data-testid="internal-track-link"]') ||
        row.querySelector('a[href*="/track/"] div');
      const title = titleEl?.textContent?.trim();

      const artistEls = row.querySelectorAll('a[href*="/artist/"]');
      const artists = Array.from(artistEls)
        .map((el) => el.textContent?.trim())
        .filter(Boolean);
      const artist = artists.join(', ');

      const trackLink = row.querySelector('a[href*="/track/"]');
      const spotifyUrl = trackLink?.getAttribute('href') || '';

      if (title) {
        tracks.push({ title, artist, spotifyUrl });
      }
    }

    return tracks;
  }

  function getScrollContainer() {
    return (
      document.querySelector('[data-testid="playlist-page"]')?.closest('[data-overlayscrollbars]') ||
      document.querySelector('[data-testid="playlist-page"]')?.parentElement ||
      document.querySelector('main') ||
      document.documentElement
    );
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const seen = new Map();
  const scrollContainer = getScrollContainer();
  const playlistName = getPlaylistName();
  const expectedCount = getExpectedTrackCount();

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
      if (noNewTracksCount >= 5) {
        break;
      }
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
    expectedCount,
    tracks: Array.from(seen.values()),
  };

  // Send via message for reliable delivery
  chrome.runtime.sendMessage({ type: 'spotify_playlist_result', payload: result });
})();
