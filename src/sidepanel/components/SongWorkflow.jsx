import { SONG_STATUS, PHASE, SOURCE_LABELS } from '../../shared/constants.js';
import {
  currentSong,
  currentIndex,
  queue,
  progress,
  phase,
  isComplete,
  openSearch,
  markDone,
  skipSong,
  goBack,
  toggleStatus,
  retrySong,
  startProcessingTracks,
} from '../stores/app-store.js';
import { ProgressBar } from './ProgressBar.jsx';

export function SongWorkflow() {
  const p = progress.value;

  if (isComplete.value || phase.value === PHASE.COMPLETE) {
    return <ResultsView />;
  }

  const song = currentSong.value;
  if (!song) {
    return (
      <div class="workflow">
        <ProgressBar current={p.current} total={p.total} saved={p.done} />
        <div class="workflow-status">Preparing...</div>
      </div>
    );
  }

  const idx = currentIndex.value;

  return (
    <div class="workflow">
      <ProgressBar current={p.current} total={p.total} saved={p.done} />

      <div class="current-song">
        <div class="current-song-header">
          <span class="song-number">#{idx + 1}</span>
          <div class="song-details">
            <span class="song-title">{song.title}</span>
            <span class="song-artist">{song.artist}</span>
          </div>
        </div>
      </div>

      <div class="search-links">
        <p class="search-prompt">Search for charts:</p>
        <div class="search-buttons">
          {Object.entries(SOURCE_LABELS).map(([source, label]) => (
            <button
              key={source}
              class="btn btn-small"
              onClick={() => openSearch(source)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div class="confirm-actions">
        {idx > 0 && (
          <button class="btn btn-muted" onClick={goBack}>
            Back
          </button>
        )}
        <button class="btn btn-primary" onClick={markDone}>
          Done
        </button>
        <button class="btn btn-muted" onClick={skipSong}>
          Skip
        </button>
      </div>
    </div>
  );
}

const RESULT_ICONS = {
  [SONG_STATUS.DONE]: '●',
  [SONG_STATUS.SKIPPED]: '–',
};

function ResultsView() {
  const q = queue.value;
  const p = progress.value;
  const hasSkipped = q.some((s) => s.status === SONG_STATUS.SKIPPED);

  return (
    <div class="results-view">
      <ProgressBar current={p.total} total={p.total} saved={p.done} />

      <ul class="results-list">
        {q.map((song, i) => (
          <li key={i} class={`result-row status-${song.status}`}>
            <button
              class="result-icon-btn"
              onClick={() => toggleStatus(i)}
              title={song.status === SONG_STATUS.DONE ? 'Mark as skipped' : 'Mark as done'}
            >
              {RESULT_ICONS[song.status] || '○'}
            </button>
            <div class="result-info">
              <span class="result-title">{song.title}</span>
              <span class="result-artist">{song.artist}</span>
            </div>
            <span class={`result-status-label status-${song.status}`}>
              {song.status === SONG_STATUS.DONE ? 'Done' : 'Skipped'}
            </span>
          </li>
        ))}
      </ul>

      <div class="results-actions">
        {hasSkipped && (
          <button class="btn btn-primary" onClick={retryAllSkipped}>
            Retry All Skipped
          </button>
        )}
        <button class="btn btn-muted" onClick={() => { phase.value = PHASE.DETECT; }}>
          New Playlist
        </button>
      </div>
    </div>
  );
}

async function retryAllSkipped() {
  const q = queue.value;
  const skipped = q.filter((s) => s.status === SONG_STATUS.SKIPPED);
  if (skipped.length === 0) return;
  const retryTracks = skipped.map((s) => ({ title: s.title, artist: s.artist }));
  await startProcessingTracks(retryTracks);
}
