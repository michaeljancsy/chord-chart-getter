export function ProgressBar({ current, total, saved }) {
  const pct = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;

  return (
    <div class="progress-bar-container">
      <div class="progress-bar">
        <div class="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div class="progress-label">
        Song {Math.min(current + 1, total)} of {total} &middot; {saved} saved
      </div>
    </div>
  );
}
