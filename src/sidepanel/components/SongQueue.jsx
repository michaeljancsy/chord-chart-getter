import { SONG_STATUS } from '../../shared/constants.js';
import { queue, currentIndex, toggleStatus, goToSong } from '../stores/app-store.js';

const STATUS_ICONS = {
  [SONG_STATUS.PENDING]: '○',
  [SONG_STATUS.ACTIVE]: '◉',
  [SONG_STATUS.DONE]: '●',
  [SONG_STATUS.SKIPPED]: '–',
};

export function SongQueue() {
  const q = queue.value;
  if (q.length === 0) return null;

  return (
    <div class="song-queue">
      <h3>Queue</h3>
      <ul class="queue-list">
        {q.map((song, i) => {
          const isCompleted = song.status === SONG_STATUS.DONE || song.status === SONG_STATUS.SKIPPED;
          return (
            <li
              key={i}
              class={`queue-item status-${song.status} ${i === currentIndex.value ? 'current' : ''}`}
              onClick={() => goToSong(i)}
              style={{ cursor: 'pointer' }}
            >
              {isCompleted ? (
                <button
                  class="queue-icon-btn"
                  onClick={(e) => { e.stopPropagation(); toggleStatus(i); }}
                  title={song.status === SONG_STATUS.DONE ? 'Mark as skipped' : 'Mark as done'}
                >
                  {STATUS_ICONS[song.status]}
                </button>
              ) : (
                <span class="queue-icon">{STATUS_ICONS[song.status] || '○'}</span>
              )}
              <span class="queue-number">{i + 1}</span>
              <div class="queue-info">
                <span class="queue-title">{song.title}</span>
                <span class="queue-artist">{song.artist}</span>
              </div>
              {song.status === SONG_STATUS.DONE && (
                <span class="queue-saved-badge">Done</span>
              )}
              {song.status === SONG_STATUS.SKIPPED && (
                <span class="queue-skipped-badge">Skipped</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
