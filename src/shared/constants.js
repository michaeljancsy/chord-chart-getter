export const SOURCES = {
  ULTIMATE_GUITAR: 'ultimate-guitar',
  CHORDIFY: 'chordify',
  SONGSTERR: 'songsterr',
};

export const CHART_TYPES = {
  CHORDS: 'Chords',
  TAB: 'Tab',
  BASS: 'Bass Tab',
  UKULELE: 'Ukulele',
};

export const SONG_STATUS = {
  PENDING: 'pending',
  SEARCHING: 'searching',
  AWAITING_SELECTION: 'awaiting_selection',
  AWAITING_CONFIRM: 'awaiting_confirm',
  SAVING: 'saving',
  SAVED: 'saved',
  SKIPPED: 'skipped',
  ERROR: 'error',
};

export const PHASE = {
  DETECT: 'detect',
  QUEUE: 'queue',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
};

export const SEARCH_URLS = {
  [SOURCES.ULTIMATE_GUITAR]: (query) =>
    `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`,
  [SOURCES.CHORDIFY]: (query) =>
    `https://chordify.net/search/${encodeURIComponent(query)}`,
  [SOURCES.SONGSTERR]: (query) =>
    `https://www.songsterr.com/?pattern=${encodeURIComponent(query)}`,
};

export const DEFAULT_PREFERENCES = {
  sources: [SOURCES.ULTIMATE_GUITAR, SOURCES.CHORDIFY, SOURCES.SONGSTERR],
  chartType: 'all', // 'chords', 'tabs', 'all'
  instrument: 'guitar', // 'guitar', 'bass', 'ukulele'
  outputFormat: 'txt', // 'txt', 'pdf'
  folderName: 'ChordCharts',
  delayMode: 'normal', // 'cautious', 'normal', 'fast'
};

export const DELAY_CONFIGS = {
  cautious: { searchMin: 4000, searchMax: 8000, pageMin: 5000, pageMax: 10000, betweenSongs: 15000 },
  normal: { searchMin: 2000, searchMax: 5000, pageMin: 3000, pageMax: 6000, betweenSongs: 8000 },
  fast: { searchMin: 1000, searchMax: 3000, pageMin: 2000, pageMax: 4000, betweenSongs: 4000 },
};
