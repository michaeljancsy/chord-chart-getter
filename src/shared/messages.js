// Message types for communication between service worker, side panel, and content scripts

export const MSG = {
  // Side panel → Service worker
  DETECT_PLAYLIST: 'detect_playlist',
  START_PROCESSING: 'start_processing',
  SELECT_RESULT: 'select_result',
  CONFIRM_SAVE: 'confirm_save',
  SKIP_SONG: 'skip_song',
  TRY_ANOTHER: 'try_another',
  PAUSE_PROCESSING: 'pause_processing',
  RESUME_PROCESSING: 'resume_processing',

  // Service worker → Side panel
  STATE_UPDATE: 'state_update',
  PLAYLIST_DETECTED: 'playlist_detected',
  SEARCH_RESULTS: 'search_results',
  CHART_PREVIEW: 'chart_preview',
  SAVE_COMPLETE: 'save_complete',
  ERROR: 'error',

  // Service worker → Content scripts (via executeScript return values mostly)
  EXTRACT_PLAYLIST: 'extract_playlist',
  EXTRACT_SEARCH_RESULTS: 'extract_search_results',
  EXTRACT_CHART_CONTENT: 'extract_chart_content',
};
