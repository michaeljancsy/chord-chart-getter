// Pure parsing functions for Ultimate Guitar pages.
// Extracted from ug-extractor.js so they can be unit-tested.

export function parseStoreData(document) {
  const store = document.querySelector('.js-store');
  if (!store) return null;
  try {
    return JSON.parse(store.dataset.content);
  } catch {
    return null;
  }
}

export function extractSearchResultsFromStore(data) {
  if (!data) return null;

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

export function extractSearchResultsFromDOM(document) {
  const resultRows = document.querySelectorAll(
    'article a[href*="/tab/"], .contentY a[href*="/tab/"], table a[href*="/tab/"], div[class*="result"] a[href*="/tab/"]'
  );

  if (resultRows.length === 0) {
    const allLinks = document.querySelectorAll('a[href*="ultimate-guitar.com"][href*="tab"]');
    if (allLinks.length === 0) return null;
    return extractFromLinks(allLinks);
  }

  return extractFromLinks(resultRows);
}

export function extractFromLinks(links) {
  const seen = new Set();
  const results = [];

  for (const link of links) {
    const url = link.href;
    if (!url || seen.has(url) || url.includes('/search')) continue;
    seen.add(url);

    const container = link.closest('tr, article, [class*="result"], [class*="item"], div') || link;

    let title = link.textContent?.trim() || '';
    let artist = '';
    let type = '';
    let rating = null;
    let votes = 0;

    const artistEl = container.querySelector(
      'a[href*="/artist/"], [class*="artist"], [class*="Artist"]'
    );
    if (artistEl) {
      artist = artistEl.textContent?.trim() || '';
    }

    const typeEl = container.querySelector(
      '[class*="type"], [class*="Type"], .badge, span'
    );
    if (typeEl && ['Chords', 'Tab', 'Bass', 'Ukulele', 'Power', 'Drums'].some(t =>
      typeEl.textContent?.includes(t))) {
      type = typeEl.textContent?.trim();
    }

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

    if (!type) {
      if (url.includes('chords')) type = 'Chords';
      else if (url.includes('bass')) type = 'Bass Tab';
      else if (url.includes('ukulele')) type = 'Ukulele';
      else if (url.includes('tab')) type = 'Tab';
    }

    if (!artist) {
      const urlPath = new URL(url).pathname;
      const parts = urlPath.split('/').filter(Boolean);
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

export function extractTabContentFromStore(data) {
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

export function extractTabContentFromDOM(document) {
  const contentEl = document.querySelector(
    '[class*="Tablature"], pre, [class*="ugm-b-tab"], [class*="js-tab-content"], .js-page, code'
  );

  const title = document.querySelector('h1')?.textContent?.trim() || document.title;
  let artist = '';
  const artistLink = document.querySelector('a[href*="/artist/"]');
  if (artistLink) artist = artistLink.textContent?.trim();

  if (!contentEl) {
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

export function findPrintButton(document) {
  // UG uses obfuscated class names, so match by visible text content.
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    const text = btn.textContent?.trim();
    if (text === 'Download PDF') return { found: true, type: 'download_pdf' };
    if (text === 'Print') return { found: true, type: 'print' };
  }
  return { found: false };
}

export function findAlternateVersions(document, data) {
  const versions = [];

  if (data) {
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
