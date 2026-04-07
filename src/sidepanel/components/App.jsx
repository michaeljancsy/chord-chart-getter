import { phase, showPreferences, error, detectPlaylist } from '../stores/app-store.js';
import { PHASE } from '../../shared/constants.js';
import { PlaylistView } from './PlaylistView.jsx';
import { SongQueue } from './SongQueue.jsx';
import { SongWorkflow } from './SongWorkflow.jsx';
import { Preferences } from './Preferences.jsx';

export function App() {
  if (showPreferences.value) {
    return (
      <div class="app">
        <Preferences />
      </div>
    );
  }

  return (
    <div class="app">
      <header class="app-header">
        <h1>Playlists-to-Chord-Charts</h1>
        <button
          class="icon-btn"
          title="Preferences"
          onClick={() => (showPreferences.value = true)}
        >
          &#9881;
        </button>
      </header>

      {error.value && (
        <div class="error-banner">
          {error.value}
          <button class="dismiss-btn" onClick={() => (error.value = null)}>
            &times;
          </button>
        </div>
      )}

      {phase.value === PHASE.DETECT && <DetectView />}
      {phase.value === PHASE.QUEUE && <PlaylistView />}
      {(phase.value === PHASE.PROCESSING || phase.value === PHASE.COMPLETE) && (
        <>
          <SongWorkflow />
          <SongQueue />
        </>
      )}
    </div>
  );
}

function DetectView() {
  return (
    <div class="detect-view">
      <div class="detect-instructions">
        <p>Open a playlist on Spotify, Apple Music, YouTube Music, YouTube, or Tidal, then click the button below.</p>
      </div>
      <button
        class="btn btn-primary btn-large"
        onClick={detectPlaylist}
      >
        Detect Playlist
      </button>
    </div>
  );
}
