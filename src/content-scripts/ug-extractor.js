// Content script for Ultimate Guitar.
// Injected on-demand via chrome.scripting.executeScript().
// Sends results back via chrome.runtime.sendMessage().

import {
  parseStoreData,
  extractSearchResultsFromStore,
  extractSearchResultsFromDOM,
  extractTabContentFromStore,
  extractTabContentFromDOM,
  findPrintButton,
  findAlternateVersions,
} from './ug-parser.js';

(() => {
  const url = window.location.href;
  let result;

  if (url.includes('/search.php') || url.includes('/search?')) {
    // Search results page
    const data = parseStoreData(document);
    const storeResults = extractSearchResultsFromStore(data);
    const domResults = storeResults || extractSearchResultsFromDOM(document);
    result = {
      type: 'search',
      results: domResults || [],
      method: storeResults ? 'js-store' : 'dom-fallback',
    };
  } else {
    // Tab content page
    const data = parseStoreData(document);
    const storeContent = extractTabContentFromStore(data);
    const base = storeContent || extractTabContentFromDOM(document) || {
      type: 'tab',
      content: null,
      error: 'Could not extract tab content',
    };
    base.printButton = findPrintButton(document);
    base.alternateVersions = findAlternateVersions(document, data);
    result = base;
  }

  chrome.runtime.sendMessage({ type: 'extractor_result', source: 'ultimate-guitar', payload: result });
})();
