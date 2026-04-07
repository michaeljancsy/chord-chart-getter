import {
  tracks,
  playlistName,
  selectedTracks,
  toggleTrack,
  selectAllTracks,
  deselectAllTracks,
  startProcessing,
} from '../stores/app-store.js';

export function PlaylistView() {
  const allSelected = selectedTracks.value.size === tracks.value.length;
  const noneSelected = selectedTracks.value.size === 0;

  return (
    <div class="playlist-view">
      <div class="playlist-header">
        <h2>{playlistName.value}</h2>
        <span class="track-count">
          {selectedTracks.value.size} of {tracks.value.length} songs selected
        </span>
      </div>

      <div class="select-controls">
        <button
          class="btn btn-small"
          onClick={allSelected ? deselectAllTracks : selectAllTracks}
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <ul class="track-list">
        {tracks.value.map((track, i) => (
          <li
            key={i}
            class={`track-item ${selectedTracks.value.has(i) ? 'selected' : ''}`}
            onClick={() => toggleTrack(i)}
          >
            <input
              type="checkbox"
              checked={selectedTracks.value.has(i)}
              onChange={() => toggleTrack(i)}
            />
            <div class="track-info">
              <span class="track-title">{track.title}</span>
              <span class="track-artist">{track.artist}</span>
            </div>
          </li>
        ))}
      </ul>

      <div class="playlist-actions">
        <button
          class="btn btn-primary btn-large"
          disabled={noneSelected}
          onClick={startProcessing}
        >
          Start Processing ({selectedTracks.value.size} songs)
        </button>
      </div>
    </div>
  );
}
