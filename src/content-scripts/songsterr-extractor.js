// Content script for Songsterr.
// Injected on-demand. Extracts search results or provides tab page info.

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
    const results = [];
    const seen = new Set();

    const links = document.querySelectorAll('a[href*="/a/wsa/"]');

    for (const link of links) {
      const href = link.href;
      if (seen.has(href)) continue;
      seen.add(href);

      const text = link.textContent?.trim() || '';
      let title = '';
      let artist = '';

      const spans = link.querySelectorAll('span, div');
      if (spans.length >= 2) {
        title = spans[0].textContent?.trim();
        artist = spans[1].textContent?.trim();
      } else if (text.includes(' by ')) {
        const parts = text.split(' by ');
        title = parts[0].trim();
        artist = parts.slice(1).join(' by ').trim();
      } else if (text.includes('\n')) {
        const parts = text.split('\n').map((s) => s.trim()).filter(Boolean);
        title = parts[0] || '';
        artist = parts[1] || '';
      } else {
        title = text;
      }

      if (title) {
        results.push({
          title,
          artist,
          type: 'Interactive Tab',
          url: href,
          source: 'songsterr',
        });
      }
    }

    return { type: 'search', results };
  }

  function extractTabPageInfo() {
    const title =
      document.querySelector('h1')?.textContent?.trim() ||
      document.title.replace(' Tab | Songsterr', '').trim();

    let songTitle = title;
    let artist = '';
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      songTitle = parts[0].trim();
      artist = parts.slice(1).join(' - ').trim();
    }

    const instrumentEls = document.querySelectorAll('[class*="instrument"], [class*="Instrument"]');
    const instruments = Array.from(instrumentEls).map((el) => el.textContent?.trim()).filter(Boolean);

    return {
      type: 'tab',
      title: songTitle,
      artist,
      instruments,
      url: window.location.href,
      source: 'songsterr',
      needsScreenshot: true,
    };
  }

  let result;
  const url = window.location.href;

  if (url.includes('pattern=') || url === 'https://www.songsterr.com/' || url.endsWith('songsterr.com')) {
    await waitForElement('a[href*="/a/wsa/"]');
    result = extractSearchResults();
  } else if (url.includes('/a/wsa/')) {
    await sleep(2000);
    result = extractTabPageInfo();
  } else {
    result = { type: 'unknown', error: 'Unrecognized Songsterr page' };
  }

  chrome.runtime.sendMessage({ type: 'extractor_result', source: 'songsterr', payload: result });
})();
