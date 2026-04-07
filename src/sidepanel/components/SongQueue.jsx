import { SONG_STATUS } from '../../shared/constants.js';
import { queue, currentIndex } from '../stores/app-store.js';

const STATUS_ICONS = {
  [SONG_STATUS.PENDING]: '○',
  [SONG_STATUS.SEARCHING]: '◌',
  [SONG_STATUS.AWAITING_SELECTION]: '◉',
  [SONG_STATUS.AWAITING_CONFIRM]: '◉',
  [SONG_STATUS.SAVING]: '◌',
  [SONG_STATUS.SAVED]: '●',
  [SONG_STATUS.SKIPPED]: '–',
  [SONG_STATUS.ERROR]: '✕',
};

export function SongQueue() {
  const q = queue.value;
  if (q.length === 0) return null;

  return (
    <div class="song-queue">
      <h3>Queue</h3>
      <ul class="queue-list">
        {q.map((song, i) => (
          <li
            key={i}
            class={`queue-item status-${song.status} ${i === currentIndex.value ? 'current' : ''}`}
          >
            <span class="queue-icon">{STATUS_ICONS[song.status] || '○'}</span>
            <span class="queue-number">{i + 1}</span>
            <div class="queue-info">
              <span class="queue-title">{song.title}</span>
              <span class="queue-artist">{song.artist}</span>
            </div>
            {song.status === SONG_STATUS.SAVED && (
              <span class="queue-saved-badge">Saved</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
