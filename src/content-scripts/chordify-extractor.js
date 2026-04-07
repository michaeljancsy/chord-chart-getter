// Content script for Chordify.
// Injected on-demand. Handles Chordify's SPA by polling for elements.

(async () => {
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForElement(selector, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = document.querySelector(selector);
      if (el) return el;
      await sleep(300);
    }
    return null;
  }

  function extractSearchResults() {
    const links = document.querySelectorAll('a[href*="/chords/"]');
    const results = [];
    const seen = new Set();

    for (const link of links) {
      const href = link.href;
      if (seen.has(href)) continue;
      seen.add(href);

      const titleEl =
        link.querySelector('[class*="title"], [class*="Title"], h3, h4') ||
        link.querySelector('span:first-child');
      const artistEl =
        link.querySelector('[class*="artist"], [class*="Artist"], [class*="subtitle"]') ||
        link.querySelector('span:nth-child(2)');

      let title = titleEl?.textContent?.trim();
      let artist = artistEl?.textContent?.trim();

      if (!title) {
        const pathParts = new URL(href).pathname.split('/').filter(Boolean);
        if (pathParts.length >= 3) {
          artist = artist || pathParts[1].replace(/-/g, ' ');
          title = pathParts[2].replace(/-/g, ' ');
        }
      }

      if (title) {
        results.push({
          title,
          artist: artist || '',
          type: 'Chords',
          url: href,
          source: 'chordify',
        });
      }
    }

    return { type: 'search', results };
  }

  function extractChordContent() {
    const title =
      document.querySelector('h1')?.textContent?.trim() ||
      document.querySelector('[class*="songTitle"], [class*="SongTitle"]')?.textContent?.trim() ||
      '';
    const artist =
      document.querySelector('[class*="artistName"], [class*="ArtistName"], h2')?.textContent?.trim() || '';

    const chordEls = document.querySelectorAll(
      '[class*="chord-"], [class*="Chord"], [data-chord], .chord'
    );
    const chordSequence = Array.from(chordEls)
      .map((el) => el.textContent?.trim() || el.getAttribute('data-chord'))
      .filter(Boolean);

    let structuredTitle = '';
    let structuredArtist = '';
    const ldJson = document.querySelector('script[type="application/ld+json"]');
    if (ldJson) {
      try {
        const ld = JSON.parse(ldJson.textContent);
        structuredTitle = ld.name || '';
        structuredArtist = ld.byArtist?.name || '';
      } catch {
        // ignore
      }
    }

    return {
      type: 'chord',
      title: title || structuredTitle,
      artist: artist || structuredArtist,
      chordSequence,
      uniqueChords: [...new Set(chordSequence)],
      source: 'chordify',
    };
  }

  let result;
  const url = window.location.href;

  if (url.includes('/search/') || url.includes('/search?')) {
    await waitForElement('a[href*="/chords/"]');
    result = extractSearchResults();
  } else if (url.includes('/chords/')) {
    await waitForElement('h1');
    result = extractChordContent();
  } else {
    result = { type: 'unknown', error: 'Unrecognized Chordify page' };
  }

  chrome.runtime.sendMessage({ type: 'extractor_result', source: 'chordify', payload: result });
})();
