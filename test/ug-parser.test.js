import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseStoreData,
  extractSearchResultsFromStore,
  extractSearchResultsFromDOM,
  extractFromLinks,
  extractTabContentFromStore,
  extractTabContentFromDOM,
  findPrintButton,
  findAlternateVersions,
} from '../src/content-scripts/ug-parser.js';

// ── helpers ──────────────────────────────────────────────────

function makeStoreDiv(storeData) {
  const div = document.createElement('div');
  div.className = 'js-store';
  div.dataset.content = JSON.stringify(storeData);
  return div;
}

function makeSearchStoreData(results) {
  return {
    store: {
      page: {
        data: {
          results,
        },
      },
    },
  };
}

function makeTabStoreData({ tab = {}, tabView = {} } = {}) {
  return {
    store: {
      page: {
        data: {
          tab,
          tab_view: tabView,
        },
      },
    },
  };
}

// ── parseStoreData ───────────────────────────────────────────

describe('parseStoreData', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns parsed JSON from .js-store element', () => {
    const data = { store: { page: { data: {} } } };
    document.body.appendChild(makeStoreDiv(data));
    expect(parseStoreData(document)).toEqual(data);
  });

  it('returns null when .js-store is missing', () => {
    expect(parseStoreData(document)).toBeNull();
  });

  it('returns null when data-content is invalid JSON', () => {
    const div = document.createElement('div');
    div.className = 'js-store';
    div.dataset.content = 'not json';
    document.body.appendChild(div);
    expect(parseStoreData(document)).toBeNull();
  });
});

// ── extractSearchResultsFromStore ────────────────────────────

describe('extractSearchResultsFromStore', () => {
  it('returns null for null data', () => {
    expect(extractSearchResultsFromStore(null)).toBeNull();
  });

  it('returns null when results path is missing', () => {
    expect(extractSearchResultsFromStore({ store: { page: { data: {} } } })).toBeNull();
  });

  it('extracts and sorts results by rating', () => {
    const data = makeSearchStoreData([
      { song_name: 'Song A', artist_name: 'Artist A', type: 'Chords', rating: 4.0, votes: 100, tab_url: 'https://ug.com/tab/a' },
      { song_name: 'Song B', artist_name: 'Artist B', type: 'Tab', rating: 4.5, votes: 200, tab_url: 'https://ug.com/tab/b' },
    ]);

    const results = extractSearchResultsFromStore(data);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Song B'); // higher rating first
    expect(results[0].rating).toBe(4.5);
    expect(results[0].source).toBe('ultimate-guitar');
  });

  it('filters out Pro results', () => {
    const data = makeSearchStoreData([
      { song_name: 'Free', artist_name: 'A', type: 'Chords', tab_url: 'https://ug.com/tab/free' },
      { song_name: 'Paid', artist_name: 'B', type: 'Pro', tab_url: 'https://ug.com/tab/paid' },
    ]);

    const results = extractSearchResultsFromStore(data);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Free');
  });

  it('filters out marketing results', () => {
    const data = makeSearchStoreData([
      { song_name: 'Real', artist_name: 'A', type: 'Chords', tab_url: 'https://ug.com/tab/real' },
      { song_name: 'Ad', artist_name: 'B', type: 'Chords', tab_url: 'https://ug.com/tab/ad', marketing_type: 'promo' },
    ]);

    const results = extractSearchResultsFromStore(data);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Real');
  });

  it('filters out results without tab_url', () => {
    const data = makeSearchStoreData([
      { song_name: 'Has URL', artist_name: 'A', type: 'Chords', tab_url: 'https://ug.com/tab/a' },
      { song_name: 'No URL', artist_name: 'B', type: 'Chords' },
    ]);

    const results = extractSearchResultsFromStore(data);
    expect(results).toHaveLength(1);
  });

  it('rounds ratings to 2 decimal places', () => {
    const data = makeSearchStoreData([
      { song_name: 'S', artist_name: 'A', type: 'Chords', rating: 4.12345, tab_url: 'https://ug.com/tab/a' },
    ]);

    const results = extractSearchResultsFromStore(data);
    expect(results[0].rating).toBe(4.12);
  });

  it('handles null rating', () => {
    const data = makeSearchStoreData([
      { song_name: 'S', artist_name: 'A', type: 'Chords', rating: null, tab_url: 'https://ug.com/tab/a' },
    ]);

    const results = extractSearchResultsFromStore(data);
    expect(results[0].rating).toBeNull();
  });

  it('reads from search.results path', () => {
    const data = {
      store: {
        page: {
          data: {
            search: {
              results: [
                { song_name: 'Deep', artist_name: 'A', type: 'Chords', tab_url: 'https://ug.com/tab/deep' },
              ],
            },
          },
        },
      },
    };

    const results = extractSearchResultsFromStore(data);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Deep');
  });
});

// ── extractTabContentFromStore ───────────────────────────────

describe('extractTabContentFromStore', () => {
  it('returns null for null data', () => {
    expect(extractTabContentFromStore(null)).toBeNull();
  });

  it('returns null when neither tab nor tab_view exist', () => {
    expect(extractTabContentFromStore({ store: { page: { data: {} } } })).toBeNull();
  });

  it('extracts tab content from store', () => {
    const data = makeTabStoreData({
      tab: {
        song_name: 'Creep',
        artist_name: 'Radiohead',
        type_name: 'Chords',
        capo: 2,
        tuning: { value: 'Standard' },
      },
      tabView: {
        wiki_tab: { content: '[ch]G[/ch] [ch]B[/ch] [ch]C[/ch] [ch]Cm[/ch]' },
      },
    });

    const result = extractTabContentFromStore(data);
    expect(result.type).toBe('tab');
    expect(result.title).toBe('Creep');
    expect(result.artist).toBe('Radiohead');
    expect(result.chartType).toBe('Chords');
    expect(result.content).toBe('[ch]G[/ch] [ch]B[/ch] [ch]C[/ch] [ch]Cm[/ch]');
    expect(result.capo).toBe(2);
    expect(result.tuning).toBe('Standard');
    expect(result.source).toBe('ultimate-guitar');
  });

  it('falls back to tab_view.tab fields when tab fields missing', () => {
    const data = makeTabStoreData({
      tab: {},
      tabView: {
        tab: {
          song_name: 'Fallback',
          artist_name: 'Artist',
          type_name: 'Tab',
        },
        wiki_tab: { content: 'e|---0---|' },
      },
    });

    const result = extractTabContentFromStore(data);
    expect(result.title).toBe('Fallback');
    expect(result.artist).toBe('Artist');
    expect(result.chartType).toBe('Tab');
  });
});

// ── extractTabContentFromDOM ─────────────────────────────────

describe('extractTabContentFromDOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('extracts from pre element', () => {
    document.body.innerHTML = `
      <h1>Wonderwall Chords</h1>
      <a href="https://ug.com/artist/oasis">Oasis</a>
      <pre>Em7  G  Dsus4  A7sus4</pre>
    `;

    const result = extractTabContentFromDOM(document);
    expect(result.type).toBe('tab');
    expect(result.title).toBe('Wonderwall Chords');
    expect(result.artist).toBe('Oasis');
    expect(result.content).toContain('Em7');
  });

  it('returns null when no content found', () => {
    document.body.innerHTML = '<div>Nothing here</div>';
    expect(extractTabContentFromDOM(document)).toBeNull();
  });

  it('falls back to large text blocks', () => {
    const longContent = 'e|' + '-0-'.repeat(50);
    document.body.innerHTML = `
      <h1>Some Tab</h1>
      <code>${longContent}</code>
    `;

    const result = extractTabContentFromDOM(document);
    expect(result).not.toBeNull();
    expect(result.content).toContain('e|');
  });
});

// ── findPrintButton ──────────────────────────────────────────

describe('findPrintButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns found:false when no button exists', () => {
    document.body.innerHTML = '<div>No button</div>';
    expect(findPrintButton(document)).toEqual({ found: false });
  });

  it('returns found:false when buttons exist but none say Download PDF or Print', () => {
    document.body.innerHTML = '<button>Share</button><button>Save</button>';
    expect(findPrintButton(document)).toEqual({ found: false });
  });

  it('finds Download PDF button', () => {
    document.body.innerHTML = `
      <button type="button" class="GZm7j KKBhY">
        <svg aria-hidden="true" viewBox="0 0 20 20"><g><path d="M4 16h12v-3h2v5H2v-5h2z"></path></g></svg>
        <span class="oc8O- RIhpE">Download PDF</span>
      </button>
    `;
    const result = findPrintButton(document);
    expect(result).toEqual({ found: true, type: 'download_pdf' });
  });

  it('finds Print button', () => {
    document.body.innerHTML = `
      <button type="button" class="GZm7j KKBhY">
        <svg aria-hidden="true" viewBox="0 0 20 20"><g><path d="M4.977 2h10.046v3H4.977z"></path></g></svg>
        <span class="oc8O- RIhpE">Print</span>
      </button>
    `;
    const result = findPrintButton(document);
    expect(result).toEqual({ found: true, type: 'print' });
  });

  it('prefers Download PDF over Print when both exist', () => {
    document.body.innerHTML = `
      <button><span>Download PDF</span></button>
      <button><span>Print</span></button>
    `;
    const result = findPrintButton(document);
    expect(result.type).toBe('download_pdf');
  });
});

// ── findAlternateVersions ────────────────────────────────────

describe('findAlternateVersions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns empty array when no versions found', () => {
    const versions = findAlternateVersions(document, null);
    expect(versions).toEqual([]);
  });

  it('extracts versions from store data', () => {
    const data = makeTabStoreData({
      tabView: {
        versions: [
          { type_name: 'Chords', tab_url: 'https://ug.com/tab/a-chords', rating: 4.5, votes: 100 },
          { type_name: 'Tab', tab_url: 'https://ug.com/tab/a-tab', rating: 3.0, votes: 50 },
        ],
      },
    });

    const versions = findAlternateVersions(document, data);
    expect(versions).toHaveLength(2);
    expect(versions[0].type).toBe('Chords');
    expect(versions[1].type).toBe('Tab');
  });

  it('extracts versions from DOM links', () => {
    document.body.innerHTML = `
      <a href="https://ug.com/tab/artist/song-chords-123">Chords</a>
      <a href="https://ug.com/tab/artist/song-tab-456">Tab</a>
    `;

    const versions = findAlternateVersions(document, null);
    expect(versions).toHaveLength(2);
  });

  it('deduplicates store and DOM versions', () => {
    const url = 'https://ug.com/tab/artist/song-chords-123';
    const data = makeTabStoreData({
      tabView: {
        versions: [{ type_name: 'Chords', tab_url: url, rating: 4.0, votes: 10 }],
      },
    });
    document.body.innerHTML = `<a href="${url}">Chords</a>`;

    const versions = findAlternateVersions(document, data);
    expect(versions).toHaveLength(1);
  });
});
