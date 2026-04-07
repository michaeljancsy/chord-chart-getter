import { SOURCES } from '../../shared/constants.js';
import { preferences, updatePreference, showPreferences } from '../stores/app-store.js';

const SOURCE_OPTIONS = [
  { id: SOURCES.ULTIMATE_GUITAR, label: 'Ultimate Guitar' },
  { id: SOURCES.CHORDIFY, label: 'Chordify' },
  { id: SOURCES.SONGSTERR, label: 'Songsterr' },
];

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
        <h3>Sources</h3>
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

      <section class="pref-section">
        <h3>Chart Type</h3>
        <select
          class="pref-select"
          value={prefs.chartType}
          onChange={(e) => updatePreference('chartType', e.target.value)}
        >
          <option value="all">All types</option>
          <option value="chords">Chords only</option>
          <option value="tabs">Tabs only</option>
        </select>
      </section>

      <section class="pref-section">
        <h3>Instrument</h3>
        <select
          class="pref-select"
          value={prefs.instrument}
          onChange={(e) => updatePreference('instrument', e.target.value)}
        >
          <option value="guitar">Guitar</option>
          <option value="bass">Bass</option>
          <option value="ukulele">Ukulele</option>
        </select>
      </section>

      <section class="pref-section">
        <h3>Output Format</h3>
        <select
          class="pref-select"
          value={prefs.outputFormat}
          onChange={(e) => updatePreference('outputFormat', e.target.value)}
        >
          <option value="txt">Plain Text (.txt)</option>
          <option value="pdf">PDF (.pdf)</option>
        </select>
      </section>

      <section class="pref-section">
        <h3>Browsing Speed</h3>
        <select
          class="pref-select"
          value={prefs.delayMode}
          onChange={(e) => updatePreference('delayMode', e.target.value)}
        >
          <option value="cautious">Cautious (slower, safer)</option>
          <option value="normal">Normal</option>
          <option value="fast">Fast (higher bot risk)</option>
        </select>
      </section>

      <section class="pref-section">
        <h3>Download Folder Name</h3>
        <input
          type="text"
          class="pref-input"
          value={prefs.folderName}
          onInput={(e) => updatePreference('folderName', e.target.value)}
          placeholder="ChordCharts"
        />
        <p class="pref-hint">Subfolder within your Downloads directory</p>
      </section>
    </div>
  );
}
