// Content script for Ultimate Guitar.
// Injected on-demand via chrome.scripting.executeScript().
// Sends results back via chrome.runtime.sendMessage().

(() => {
  function getStoreData() {
    const store = document.querySelector('.js-store');
    if (!store) return null;
    try {
      return JSON.parse(store.dataset.content);
    } catch {
      return null;
    }
  }

  function extractSearchResultsFromStore() {
    const data = getStoreData();
    if (!data) return null;

    // Try multiple possible data paths
    const results =
      data?.store?.page?.data?.results ||
      data?.store?.page?.data?.search?.results ||
      data?.store?.page?.data?.list;

    if (!Array.isArray(results)) return null;

    return results
      .filter((r) => r.tab_url && r.type !== 'Pro' && r.marketing_type == null)
      .map((r) => ({
        title: r.song_name,
        artist: r.artist_name,
        type: r.type,
        rating: r.rating ? Math.round(r.rating * 100) / 100 : null,
        votes: r.votes || 0,
        url: r.tab_url,
        source: 'ultimate-guitar',
      }))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  function extractSearchResultsFromDOM() {
    // Fallback: read search results directly from the DOM
    const resultRows = document.querySelectorAll(
      'article a[href*="/tab/"], .contentY a[href*="/tab/"], table a[href*="/tab/"], div[class*="result"] a[href*="/tab/"]'
    );

    if (resultRows.length === 0) {
      // Try broader selectors
      const allLinks = document.querySelectorAll('a[href*="ultimate-guitar.com"][href*="tab"]');
      if (allLinks.length === 0) return null;
      return extractFromLinks(allLinks);
    }

    return extractFromLinks(resultRows);
  }

  function extractFromLinks(links) {
    const seen = new Set();
    const results = [];

    for (const link of links) {
      const url = link.href;
      if (!url || seen.has(url) || url.includes('/search')) continue;
      seen.add(url);

      // Walk up to find the row/container for this result
      const container = link.closest('tr, article, [class*="result"], [class*="item"], div') || link;

      // Try to extract song title and artist
      let title = link.textContent?.trim() || '';
      let artist = '';
      let type = '';
      let rating = null;
      let votes = 0;

      // Look for artist in sibling or parent elements
      const artistEl = container.querySelector(
        'a[href*="/artist/"], [class*="artist"], [class*="Artist"]'
      );
      if (artistEl) {
        artist = artistEl.textContent?.trim() || '';
      }

      // Look for type badge
      const typeEl = container.querySelector(
        '[class*="type"], [class*="Type"], .badge, span'
      );
      if (typeEl && ['Chords', 'Tab', 'Bass', 'Ukulele', 'Power', 'Drums'].some(t =>
        typeEl.textContent?.includes(t))) {
        type = typeEl.textContent?.trim();
      }

      // Look for rating
      const ratingEl = container.querySelector(
        '[class*="rating"], [class*="Rating"]'
      );
      if (ratingEl) {
        const ratingText = ratingEl.textContent?.trim();
        const ratingMatch = ratingText?.match(/[\d.]+/);
        if (ratingMatch) rating = parseFloat(ratingMatch[0]);
        const votesMatch = ratingText?.match(/(\d+)\s*$/);
        if (votesMatch) votes = parseInt(votesMatch[1], 10);
      }

      // Parse type from URL if not found in DOM
      if (!type) {
        if (url.includes('chords')) type = 'Chords';
        else if (url.includes('bass')) type = 'Bass Tab';
        else if (url.includes('ukulele')) type = 'Ukulele';
        else if (url.includes('tab')) type = 'Tab';
      }

      // Parse artist from URL if not found in DOM: /tab/artist-name/song-name
      if (!artist) {
        const urlPath = new URL(url).pathname;
        const parts = urlPath.split('/').filter(Boolean);
        // Format: /tab/artist-name/song-name-chords-123456
        if (parts.length >= 3 && parts[0] === 'tab') {
          artist = parts[1].replace(/-/g, ' ');
        }
      }

      if (title && url) {
        results.push({ title, artist, type, rating, votes, url, source: 'ultimate-guitar' });
      }
    }

    return results.length > 0 ? results : null;
  }

  function extractTabContentFromStore() {
    const data = getStoreData();
    if (!data) return null;

    const tabView = data?.store?.page?.data?.tab_view;
    const tab = data?.store?.page?.data?.tab;

    if (!tabView && !tab) return null;

    return {
      type: 'tab',
      title: tab?.song_name || tabView?.tab?.song_name,
      artist: tab?.artist_name || tabView?.tab?.artist_name,
      chartType: tab?.type_name || tabView?.tab?.type_name,
      content: tabView?.wiki_tab?.content || '',
      capo: tab?.capo || tabView?.tab?.capo || 0,
      tuning: tab?.tuning?.value || tabView?.tab?.tuning?.value || '',
      source: 'ultimate-guitar',
    };
  }

  function extractTabContentFromDOM() {
    // Fallback: read tab/chord content from the rendered page
    const contentEl = document.querySelector(
      '[class*="Tablature"], pre, [class*="ugm-b-tab"], [class*="js-tab-content"], .js-page, code'
    );

    const title = document.querySelector('h1')?.textContent?.trim() || document.title;
    let artist = '';
    const artistLink = document.querySelector('a[href*="/artist/"]');
    if (artistLink) artist = artistLink.textContent?.trim();

    if (!contentEl) {
      // Try to get any large text block that looks like a tab
      const allPres = document.querySelectorAll('pre, code, [class*="tab"]');
      for (const pre of allPres) {
        if (pre.textContent.length > 100) {
          return {
            type: 'tab',
            title,
            artist,
            chartType: 'Unknown',
            content: pre.textContent,
            capo: 0,
            tuning: '',
            source: 'ultimate-guitar',
          };
        }
      }
      return null;
    }

    return {
      type: 'tab',
      title,
      artist,
      chartType: 'Unknown',
      content: contentEl.textContent || contentEl.innerText || '',
      capo: 0,
      tuning: '',
      source: 'ultimate-guitar',
    };
  }

  function findPrintButton() {
    // UG print button — look for various selectors
    const printBtn =
      document.querySelector('[class*="print" i]') ||
      document.querySelector('button[aria-label*="print" i]') ||
      document.querySelector('a[href*="print"]') ||
      document.querySelector('[data-action*="print"]');

    if (printBtn) {
      // If it's a link, return the href
      if (printBtn.tagName === 'A' && printBtn.href) {
        return { found: true, type: 'link', url: printBtn.href };
      }
      return { found: true, type: 'button' };
    }
    return { found: false };
  }

  function findAlternateVersions() {
    // Look for links to chord/tab versions of the same song on the page
    const data = getStoreData();
    const versions = [];

    if (data) {
      // Check store for alternate versions
      const tab = data?.store?.page?.data?.tab;
      const tabView = data?.store?.page?.data?.tab_view;

      // UG often has "versions" or "other versions" data
      const otherVersions = data?.store?.page?.data?.tab_view?.versions ||
        data?.store?.page?.data?.versions || [];

      for (const v of otherVersions) {
        if (v.tab_url && v.type_name) {
          versions.push({
            type: v.type_name,
            url: v.tab_url,
            rating: v.rating || 0,
            votes: v.votes || 0,
          });
        }
      }
    }

    // Also check DOM for version links
    const versionLinks = document.querySelectorAll('a[href*="/tab/"][href*="chords"], a[href*="/tab/"][href*="-tab-"]');
    for (const link of versionLinks) {
      const href = link.href;
      if (href && !versions.some(v => v.url === href)) {
        let type = 'Unknown';
        if (href.includes('chords')) type = 'Chords';
        else if (href.includes('-tab-') || href.includes('-tabs-')) type = 'Tab';
        versions.push({ type, url: href, rating: 0, votes: 0 });
      }
    }

    return versions;
  }

  // Detect which page we're on and extract
  const url = window.location.href;
  let result;

  if (url.includes('/search.php') || url.includes('/search?')) {
    // Search results page
    const storeResults = extractSearchResultsFromStore();
    const domResults = storeResults || extractSearchResultsFromDOM();
    result = {
      type: 'search',
      results: domResults || [],
      method: storeResults ? 'js-store' : 'dom-fallback',
    };
  } else {
    // Tab content page
    const storeContent = extractTabContentFromStore();
    const base = storeContent || extractTabContentFromDOM() || {
      type: 'tab',
      content: null,
      error: 'Could not extract tab content',
    };
    // Augment with print button info and alternate versions
    base.printButton = findPrintButton();
    base.alternateVersions = findAlternateVersions();
    result = base;
  }

  chrome.runtime.sendMessage({ type: 'extractor_result', source: 'ultimate-guitar', payload: result });
})();
