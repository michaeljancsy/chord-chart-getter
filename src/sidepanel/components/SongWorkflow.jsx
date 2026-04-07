import { SONG_STATUS, PHASE, SOURCES } from '../../shared/constants.js';
import {
  currentSong,
  currentIndex,
  queue,
  progress,
  phase,
  paused,
  isComplete,
  selectResult,
  confirmSave,
  skipSong,
  tryAnother,
  pauseProcessing,
  resumeProcessing,
  playlistName,
} from '../stores/app-store.js';
import { ProgressBar } from './ProgressBar.jsx';

const SOURCE_LABELS = {
  [SOURCES.ULTIMATE_GUITAR]: 'Ultimate Guitar',
  [SOURCES.CHORDIFY]: 'Chordify',
  [SOURCES.SONGSTERR]: 'Songsterr',
};

export function SongWorkflow() {
  const p = progress.value;

  if (isComplete.value || phase.value === PHASE.COMPLETE) {
    return <CompletionView />;
  }

  const song = currentSong.value;
  if (!song) {
    return (
      <div class="workflow">
        <ProgressBar current={p.current} total={p.total} saved={p.saved} />
        <div class="workflow-status">Preparing...</div>
      </div>
    );
  }

  return (
    <div class="workflow">
      <ProgressBar current={p.current} total={p.total} saved={p.saved} />

      <div class="current-song">
        <div class="current-song-header">
          <span class="song-number">#{currentIndex.value + 1}</span>
          <div class="song-details">
            <span class="song-title">{song.title}</span>
            <span class="song-artist">{song.artist}</span>
          </div>
          <StatusBadge status={song.status} />
        </div>
      </div>

      <div class="pause-controls">
        {paused.value ? (
          <button class="btn btn-small" onClick={resumeProcessing}>
            Resume
          </button>
        ) : (
          <button class="btn btn-small btn-muted" onClick={pauseProcessing}>
            Pause
          </button>
        )}
      </div>

      {song.status === SONG_STATUS.SEARCHING && <SearchingState />}
      {song.status === SONG_STATUS.AWAITING_SELECTION && (
        <SelectionState searchResults={song.searchResults} />
      )}
      {song.status === SONG_STATUS.AWAITING_CONFIRM && (
        <ConfirmState chartData={song.chartData} selectedResult={song.selectedResult} />
      )}
      {song.status === SONG_STATUS.SAVING && <SavingState />}
      {song.status === SONG_STATUS.ERROR && <ErrorState error={song.error} />}
    </div>
  );
}

function CompletionView() {
  const p = progress.value;
  return (
    <div class="completion-view">
      <div class="completion-icon">&#10003;</div>
      <h2>All Done!</h2>
      <div class="completion-stats">
        <div class="stat">
          <span class="stat-value">{p.saved}</span>
          <span class="stat-label">Saved</span>
        </div>
        <div class="stat">
          <span class="stat-value">{p.skipped}</span>
          <span class="stat-label">Skipped</span>
        </div>
        <div class="stat">
          <span class="stat-value">{p.total}</span>
          <span class="stat-label">Total</span>
        </div>
      </div>
      <button
        class="btn btn-primary"
        onClick={() => {
          phase.value = PHASE.DETECT;
        }}
      >
        Process Another Playlist
      </button>
    </div>
  );
}

function StatusBadge({ status }) {
  const labels = {
    [SONG_STATUS.PENDING]: 'Pending',
    [SONG_STATUS.SEARCHING]: 'Searching...',
    [SONG_STATUS.AWAITING_SELECTION]: 'Pick a match',
    [SONG_STATUS.AWAITING_CONFIRM]: 'Confirm',
    [SONG_STATUS.SAVING]: 'Saving...',
    [SONG_STATUS.SAVED]: 'Saved',
    [SONG_STATUS.SKIPPED]: 'Skipped',
    [SONG_STATUS.ERROR]: 'Error',
  };
  return <span class={`status-badge status-${status}`}>{labels[status] || status}</span>;
}

function SearchingState() {
  return (
    <div class="workflow-state">
      <div class="spinner" />
      <p>Searching for charts...</p>
    </div>
  );
}

function SelectionState({ searchResults }) {
  const sources = Object.keys(searchResults || {});

  if (sources.length === 0) {
    return (
      <div class="workflow-state">
        <p>No results found.</p>
        <button class="btn btn-muted" onClick={skipSong}>
          Skip Song
        </button>
      </div>
    );
  }

  const allEmpty = sources.every((s) => (searchResults[s] || []).length === 0);
  if (allEmpty) {
    return (
      <div class="workflow-state">
        <p>No matching charts found on any source.</p>
        <button class="btn btn-muted" onClick={skipSong}>
          Skip Song
        </button>
      </div>
    );
  }

  return (
    <div class="selection-state">
      <p class="selection-prompt">Select a chart:</p>
      {sources.map((source) => {
        const results = searchResults[source] || [];
        if (results.length === 0) return null;
        return (
          <div key={source} class="source-group">
            <h3 class="source-label">{SOURCE_LABELS[source] || source}</h3>
            <ul class="result-list">
              {results.slice(0, 8).map((result, i) => (
                <li key={i} class="result-item" onClick={() => selectResult(result)}>
                  <div class="result-main">
                    <span class="result-title">{result.title}</span>
                    <span class="result-artist">{result.artist}</span>
                  </div>
                  <div class="result-meta">
                    <span class="type-badge">{result.type}</span>
                    {result.rating != null && (
                      <span class="rating">
                        {'★'.repeat(Math.round(result.rating))} {result.rating}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <button class="btn btn-muted" onClick={skipSong}>
        Skip Song
      </button>
    </div>
  );
}

function ConfirmState({ chartData, selectedResult }) {
  const isUG = selectedResult?.source === 'ultimate-guitar';
  const hasAlternateVersions = chartData?.alternateVersions?.length > 0;
  const currentType = selectedResult?.type || chartData?.chartType || '';
  const hasPreview =
    chartData &&
    (chartData.content || chartData.chordSequence?.length > 0 || chartData.needsScreenshot);

  return (
    <div class="confirm-state">
      {selectedResult && (
        <div class="selected-info">
          <span class="type-badge">{selectedResult.type}</span>
          <span>
            {selectedResult.title} — {selectedResult.artist}
          </span>
          <span class="source-tag">{SOURCE_LABELS[selectedResult.source]}</span>
        </div>
      )}

      {chartData?.content && (
        <div class="chart-preview">
          <pre>{chartData.content.substring(0, 500)}...</pre>
        </div>
      )}

      {chartData?.chordSequence?.length > 0 && (
        <div class="chart-preview">
          <p>
            <strong>Chords:</strong> {chartData.uniqueChords?.join(', ')}
          </p>
        </div>
      )}

      {chartData?.needsScreenshot && (
        <div class="chart-preview">
          <p>Interactive tab loaded. A screenshot will be saved.</p>
        </div>
      )}

      {!hasPreview && (
        <div class="chart-preview">
          <p>Chart loaded. Check the browser tab to preview.</p>
        </div>
      )}

      {isUG ? (
        <UGDownloadChoice
          currentType={currentType}
          hasAlternate={hasAlternateVersions}
        />
      ) : (
        <div class="confirm-actions">
          <button class="btn btn-primary" onClick={() => confirmSave()}>
            Save This
          </button>
          <button class="btn btn-muted" onClick={tryAnother}>
            Try Another
          </button>
          <button class="btn btn-muted" onClick={skipSong}>
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

function UGDownloadChoice({ currentType, hasAlternate }) {
  const otherType = currentType === 'Chords' ? 'Tab' : 'Chords';

  return (
    <div class="ug-download-choice">
      <p class="choice-label">Download as PDF:</p>
      <div class="choice-buttons">
        <button
          class="btn btn-primary"
          onClick={() => confirmSave('current')}
        >
          {currentType || 'This Version'}
        </button>
        {hasAlternate && (
          <button
            class="btn btn-primary"
            onClick={() => confirmSave('both')}
          >
            Both ({currentType} + {otherType})
          </button>
        )}
      </div>
      <div class="confirm-actions">
        <button class="btn btn-muted" onClick={tryAnother}>
          Try Another
        </button>
        <button class="btn btn-muted" onClick={skipSong}>
          Skip
        </button>
      </div>
    </div>
  );
}

function SavingState() {
  return (
    <div class="workflow-state">
      <div class="spinner" />
      <p>Saving chart...</p>
    </div>
  );
}

function ErrorState({ error }) {
  return (
    <div class="workflow-state error">
      <p>Error: {error}</p>
      <div class="confirm-actions">
        <button class="btn btn-muted" onClick={tryAnother}>
          Try Another
        </button>
        <button class="btn btn-muted" onClick={skipSong}>
          Skip
        </button>
      </div>
    </div>
  );
}
