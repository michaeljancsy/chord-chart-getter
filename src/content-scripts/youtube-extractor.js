// Content script injected into youtube.com to extract playlist tracks.
// YouTube video titles often include "Artist - Song" or "Song - Artist" patterns.

(async () => {
  const SCROLL_DELAY = 500;
  const MAX_SCROLL_ATTEMPTS = 200;

  function getPlaylistName() {
    return (
      document.querySelector('h3.ytd-playlist-sidebar-primary-info-renderer')?.textContent?.trim() ||
      document.querySelector('#header-description h3')?.textContent?.trim() ||
      document.querySelector('.metadata-wrapper yt-formatted-string')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      'Unknown Playlist'
    );
  }

  function parseVideoTitle(rawTitle) {
    // Try to split "Artist - Song" or "Song - Artist" patterns
    // Also strip common suffixes like (Official Video), [Lyrics], etc.
    let cleaned = rawTitle
      .replace(/\s*[\(\[](?:official\s*(?:video|audio|music\s*video|lyric\s*video)|lyrics?|audio|hd|hq|remaster(?:ed)?|live|ft\.?[^)\]]*|feat\.?[^)\]]*)[\)\]]/gi, '')
      .trim();

    const dashMatch = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (dashMatch) {
      return { artist: dashMatch[1].trim(), title: dashMatch[2].trim() };
    }

    return { artist: '', title: cleaned };
  }

  function extractVisibleTracks() {
    const tracks = [];
    // Scope to the primary playlist container to exclude suggestions
    const container =
      document.querySelector('ytd-playlist-video-list-renderer, ytd-section-list-renderer[page-subtype="playlist"]') ||
      document;
    const rows = container.querySelectorAll(
      'ytd-playlist-video-renderer'
    );

    for (const row of rows) {
      const titleEl =
        row.querySelector('#video-title') ||
        row.querySelector('a#video-title');
      const rawTitle = titleEl?.textContent?.trim();
      if (!rawTitle) continue;

      // Try to get channel name as fallback artist
      const channelEl =
        row.querySelector('#channel-name a, .ytd-channel-name a') ||
        row.querySelector('#channel-name yt-formatted-string, .ytd-channel-name yt-formatted-string');
      const channelName = channelEl?.textContent?.trim() || '';

      const parsed = parseVideoTitle(rawTitle);
      if (!parsed.artist && channelName) {
        // Strip " - Topic" suffix YouTube auto-generates for music channels
        parsed.artist = channelName.replace(/\s*-\s*Topic$/i, '');
      }

      tracks.push(parsed);
    }

    return tracks;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const seen = new Map();
  const scrollContainer = document.documentElement;
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
