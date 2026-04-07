export const SOURCES = {
  ULTIMATE_GUITAR: 'ultimate-guitar',
  CHORDIFY: 'chordify',
  SONGSTERR: 'songsterr',
  MUSESCORE: 'musescore',
  SHEET_MUSIC_DIRECT: 'sheet-music-direct',
  YOUTUBE: 'youtube',
};

export const SONG_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  DONE: 'done',
  SKIPPED: 'skipped',
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
  [SOURCES.MUSESCORE]: (query) =>
    `https://musescore.com/sheetmusic?text=${encodeURIComponent(query)}`,
  [SOURCES.SHEET_MUSIC_DIRECT]: (query) =>
    `https://www.sheetmusicdirect.com/en-US/search.aspx?query=${encodeURIComponent(query)}`,
  [SOURCES.YOUTUBE]: (query) =>
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' chords tutorial')}`,
};

export const SOURCE_LABELS = {
  [SOURCES.CHORDIFY]: 'Chordify',
  [SOURCES.MUSESCORE]: 'Musescore',
  [SOURCES.SHEET_MUSIC_DIRECT]: 'Sheet Music Direct',
  [SOURCES.SONGSTERR]: 'Songsterr',
  [SOURCES.ULTIMATE_GUITAR]: 'Ultimate Guitar',
  [SOURCES.YOUTUBE]: 'YouTube',
};

export const DEFAULT_PREFERENCES = {
  sources: Object.values(SOURCES),
};
