// Content script injected into music.youtube.com to extract playlist tracks.

(async () => {
  const SCROLL_DELAY = 500;
  const MAX_SCROLL_ATTEMPTS = 200;

  function getPlaylistName() {
    return (
      document.querySelector('ytmusic-detail-header-renderer h2')?.textContent?.trim() ||
      document.querySelector('ytmusic-responsive-header-renderer h2')?.textContent?.trim() ||
      document.querySelector('h2.ytmusic-detail-header-renderer')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      'Unknown Playlist'
    );
  }

  function extractVisibleTracks() {
    const tracks = [];
    const rows = document.querySelectorAll(
      'ytmusic-responsive-list-item-renderer, ytmusic-playlist-shelf-renderer ytmusic-responsive-list-item-renderer'
    );

    for (const row of rows) {
      const titleEl =
        row.querySelector('.title yt-formatted-string, .title a') ||
        row.querySelector('yt-formatted-string.title');
      const title = titleEl?.textContent?.trim();

      const artistEl =
        row.querySelector('.secondary-flex-columns yt-formatted-string a') ||
        row.querySelector('.flex-columns .secondary yt-formatted-string a') ||
        row.querySelector('.subtitle yt-formatted-string a');
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
  const scrollContainer =
    document.querySelector('#contents.ytmusic-section-list-renderer')?.closest('[scrollable]') ||
    document.querySelector('ytmusic-app') ||
    document.documentElement;
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
