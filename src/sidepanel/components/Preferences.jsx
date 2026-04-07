import { SOURCES, SOURCE_LABELS } from '../../shared/constants.js';
import { preferences, updatePreference, showPreferences } from '../stores/app-store.js';

const SOURCE_OPTIONS = Object.entries(SOURCE_LABELS).map(([id, label]) => ({ id, label }));

export function Preferences() {
  const prefs = preferences.value;

  function toggleSource(sourceId) {
    const current = prefs.sources || [];
    const newSources = current.includes(sourceId)
      ? current.filter((s) => s !== sourceId)
      : [...current, sourceId];
    if (newSources.length > 0) {
      updatePreference('sources', newSources);
    }
  }

  return (
    <div class="preferences">
      <div class="prefs-header">
        <h2>Preferences</h2>
        <button class="btn btn-small" onClick={() => (showPreferences.value = false)}>
          Done
        </button>
      </div>

      <section class="pref-section">
        <h3>Search Sources</h3>
        <p class="pref-hint">Which sites to show search buttons for</p>
        <div class="pref-options">
          {SOURCE_OPTIONS.map((opt) => (
            <label key={opt.id} class="pref-checkbox">
              <input
                type="checkbox"
                checked={(prefs.sources || []).includes(opt.id)}
                onChange={() => toggleSource(opt.id)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
