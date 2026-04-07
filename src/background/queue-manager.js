import { SONG_STATUS, SOURCES, SEARCH_URLS } from '../shared/constants.js';
import { searchDelay, pageDelay, betweenSongsDelay, humanDelay } from './delay-utils.js';
import { saveChart, saveChartFromUrl, captureTabScreenshot } from './download-manager.js';

export class QueueManager {
  constructor() {
    this.queue = [];
    this.currentIndex = -1;
    this.chartTabId = null;
    this.playlistName = '';
    this.preferences = {};
    this.paused = false;
    this.onStateChange = null;
    this._extractorResolve = null;
    this._printResolve = null;

    // Track the "last source we were working with" so we know what to
    // re-inject when the tab reloads.
    this._activeSource = null;
    this._tabReloadListener = null;
  }

  // ── state helpers ──────────────────────────────────────────────

  init({ tracks, playlistName, preferences, onStateChange }) {
    this.queue = tracks.map((track) => ({
      ...track,
      status: SONG_STATUS.PENDING,
      searchResults: {},
      selectedResult: null,
      chartData: null,
      savedFile: null,
      error: null,
    }));
    this.currentIndex = -1;
    this.playlistName = playlistName;
    this.preferences = preferences;
    this.onStateChange = onStateChange;
    this.paused = false;
    this._startTabReloadWatcher();
    this.broadcastState();
  }

  getState() {
    return {
      queue: this.queue,
      currentIndex: this.currentIndex,
      playlistName: this.playlistName,
      paused: this.paused,
      progress: {
        total: this.queue.length,
        saved: this.queue.filter((s) => s.status === SONG_STATUS.SAVED).length,
        skipped: this.queue.filter((s) => s.status === SONG_STATUS.SKIPPED).length,
        current: this.currentIndex,
      },
    };
  }

  broadcastState() {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
    chrome.storage.local.set({ queueState: this.getState() });
  }

  updateSong(index, updates) {
    Object.assign(this.queue[index], updates);
    this.broadcastState();
  }

  handleExtractorResult(message) {
    if (this._extractorResolve) {
      this._extractorResolve(message.payload);
      this._extractorResolve = null;
    }
  }

  handlePrintResult(message) {
    if (this._printResolve) {
      this._printResolve(message.payload);
      this._printResolve = null;
    }
  }

  // ── tab reload watcher ─────────────────────────────────────────
  //
  // After the initial navigation, the chart tab may reload for many
  // reasons (redirects, cookie walls, anti-bot challenges, JS-driven
  // page transitions).  When we see a *new* 'complete' event that we
  // didn't initiate via navigateAndWait, we re-inject the appropriate
  // extractor so the side-panel data stays current.

  _startTabReloadWatcher() {
    this._stopTabReloadWatcher();

    this._tabReloadListener = async (tabId, changeInfo) => {
      if (tabId !== this.chartTabId) return;
      if (changeInfo.status !== 'complete') return;
      // Only act when we're NOT in the middle of our own navigateAndWait
      // (navigateAndWait sets _navigating = true while it's working).
      if (this._navigating) return;

      const song = this.queue[this.currentIndex];
      if (!song) return;

      // Determine what to do based on the song's current status.
      const source = this._activeSource;
      if (!source) return;

      // Small delay to let the reloaded page settle.
      await humanDelay(1000, 2000);

      if (
        song.status === SONG_STATUS.SEARCHING ||
        song.status === SONG_STATUS.AWAITING_SELECTION ||
        song.status === SONG_STATUS.AWAITING_CONFIRM
      ) {
        console.log(`Tab reloaded while ${song.status} — re-injecting ${source} extractor`);
        const result = await this.injectExtractor(source);
        if (!result) return;

        if (result.type === 'search' && result.results?.length > 0) {
          this.queue[this.currentIndex].searchResults[source] = result.results;
          this.updateSong(this.currentIndex, { status: SONG_STATUS.AWAITING_SELECTION });
        } else if (result.type === 'tab' || result.type === 'chord') {
          this.updateSong(this.currentIndex, {
            status: SONG_STATUS.AWAITING_CONFIRM,
            chartData: result,
          });
        }
      }
    };

    chrome.tabs.onUpdated.addListener(this._tabReloadListener);
  }

  _stopTabReloadWatcher() {
    if (this._tabReloadListener) {
      chrome.tabs.onUpdated.removeListener(this._tabReloadListener);
      this._tabReloadListener = null;
    }
  }

  // ── tab management ─────────────────────────────────────────────

  async ensureChartTab() {
    if (this.chartTabId) {
      try {
        await chrome.tabs.get(this.chartTabId);
        return;
      } catch {
        this.chartTabId = null;
      }
    }
    const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
    this.chartTabId = tab.id;
  }

  /**
   * Navigate the chart tab and wait for 'complete'.
   * Sets _navigating flag so the reload watcher doesn't fire during
   * our own navigation.
   */
  async navigateAndWait(url) {
    await this.ensureChartTab();
    this._navigating = true;
    await chrome.tabs.update(this.chartTabId, { url, active: true });

    await new Promise((resolve) => {
      const tabId = this.chartTabId;
      function listener(id, info) {
        if (id === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 20000);
    });

    this._navigating = false;
  }

  // ── extractor injection ────────────────────────────────────────

  /**
   * Determine the correct extractor file for a source, inject it,
   * and wait for the result message.
   */
  async injectExtractor(source) {
    const scriptMap = {
      [SOURCES.ULTIMATE_GUITAR]: 'ug-extractor.js',
      [SOURCES.CHORDIFY]: 'chordify-extractor.js',
      [SOURCES.SONGSTERR]: 'songsterr-extractor.js',
    };

    const file = scriptMap[source];
    if (!file) throw new Error(`Unknown source: ${source}`);

    this._activeSource = source;

    const resultPromise = new Promise((resolve) => {
      this._extractorResolve = resolve;
      setTimeout(() => {
        if (this._extractorResolve === resolve) {
          this._extractorResolve = null;
          resolve(null);
        }
      }, 15000);
    });

    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.chartTabId },
        files: [file],
      });
    } catch (err) {
      this._extractorResolve = null;
      console.error(`Failed to inject ${file}:`, err);
      return null;
    }

    return resultPromise;
  }

  /**
   * Inject extractor with automatic retry on empty results.
   * Handles the case where the page is still loading / transitioning
   * when we first inject.
   */
  async injectExtractorWithRetry(source, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.injectExtractor(source);

      // If we got a usable result, return it
      if (result) {
        const hasContent =
          (result.type === 'search' && result.results?.length > 0) ||
          (result.type === 'tab' && result.content) ||
          (result.type === 'chord' && result.chordSequence?.length > 0) ||
          result.needsScreenshot;

        if (hasContent) return result;
      }

      // No usable result — wait and try again (the page may still be loading)
      if (attempt < maxRetries) {
        console.log(`Extractor returned empty for ${source}, retrying in 3s (attempt ${attempt + 1}/${maxRetries})`);
        await humanDelay(2000, 4000);
      }
    }

    // Return whatever we got on the last attempt (even if empty)
    return this.injectExtractor(source);
  }

  // ── queue processing ───────────────────────────────────────────

  async processNext() {
    if (this.paused) return;

    this.currentIndex++;
    if (this.currentIndex >= this.queue.length) {
      this._stopTabReloadWatcher();
      this.broadcastState();
      return;
    }

    if (this.currentIndex > 0) {
      await betweenSongsDelay(this.preferences.delayMode, this.queue.length);
    }

    const song = this.queue[this.currentIndex];
    this.updateSong(this.currentIndex, { status: SONG_STATUS.SEARCHING });

    try {
      await this.searchAllSources(this.currentIndex, song);
    } catch (err) {
      this.updateSong(this.currentIndex, {
        status: SONG_STATUS.ERROR,
        error: err.message,
      });
    }
  }

  async searchAllSources(index, song) {
    const query = `${song.artist} ${song.title}`;
    const sources = this.preferences.sources || [SOURCES.ULTIMATE_GUITAR];

    for (const source of sources) {
      if (this.paused) return;

      const searchUrl = SEARCH_URLS[source](query);
      await this.navigateAndWait(searchUrl);
      await searchDelay(this.preferences.delayMode);

      const result = await this.injectExtractorWithRetry(source);
      if (result && result.results && result.results.length > 0) {
        this.queue[index].searchResults[source] = result.results;
      }
    }

    this.updateSong(index, { status: SONG_STATUS.AWAITING_SELECTION });
  }

  async selectResult(resultData) {
    const index = this.currentIndex;
    this.updateSong(index, {
      status: SONG_STATUS.AWAITING_CONFIRM,
      selectedResult: resultData,
    });

    this._activeSource = resultData.source;
    await this.navigateAndWait(resultData.url);
    await pageDelay(this.preferences.delayMode);

    let chartData;
    if (resultData.source === 'songsterr') {
      chartData = await this.injectExtractorWithRetry(SOURCES.SONGSTERR);
      try {
        const screenshotDataUrl = await captureTabScreenshot();
        if (chartData) chartData.screenshotDataUrl = screenshotDataUrl;
      } catch {
        if (chartData) chartData.screenshotDataUrl = null;
      }
    } else {
      chartData = await this.injectExtractorWithRetry(resultData.source);
    }

    this.updateSong(index, { chartData });
    this.broadcastState();
  }

  // ── UG print / PDF ─────────────────────────────────────────────

  async _triggerUGPrint() {
    const printResultPromise = new Promise((resolve) => {
      this._printResolve = resolve;
      setTimeout(() => {
        if (this._printResolve === resolve) {
          this._printResolve = null;
          resolve(null);
        }
      }, 10000);
    });

    let newTabUrl = null;
    const newTabPromise = new Promise((resolve) => {
      function tabListener(tab) {
        if (tab.pendingUrl || tab.url) {
          newTabUrl = tab.pendingUrl || tab.url;
          chrome.tabs.onCreated.removeListener(tabListener);
          setTimeout(() => resolve(tab), 2000);
        }
      }
      chrome.tabs.onCreated.addListener(tabListener);
      setTimeout(() => {
        chrome.tabs.onCreated.removeListener(tabListener);
        resolve(null);
      }, 8000);
    });

    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.chartTabId },
        files: ['ug-print-trigger.js'],
      });
    } catch (err) {
      console.error('Failed to inject print trigger:', err);
      return { type: 'error', error: err.message };
    }

    const printResult = await printResultPromise;

    if (printResult?.action === 'link') {
      return { type: 'pdf_url', url: printResult.url };
    }

    const newTab = await newTabPromise;

    if (newTab) {
      await new Promise((resolve) => {
        function listener(tabId, info) {
          if (tabId === newTab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        }
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 10000);
      });

      const updatedTab = await chrome.tabs.get(newTab.id);
      return { type: 'pdf_tab', url: updatedTab.url, tabId: newTab.id };
    }

    return { type: 'print_dialog' };
  }

  async confirmSave(downloadChoice) {
    const index = this.currentIndex;
    const song = this.queue[index];

    this.updateSong(index, { status: SONG_STATUS.SAVING });

    try {
      if (song.selectedResult?.source === 'ultimate-guitar') {
        await this._saveUG(index, song, downloadChoice);
      } else {
        const result = await saveChart({
          chartData: song.chartData,
          songIndex: index,
          playlistName: this.playlistName,
          preferences: this.preferences,
        });
        this.updateSong(index, { status: SONG_STATUS.SAVED, savedFile: result });
      }
    } catch (err) {
      this.updateSong(index, { status: SONG_STATUS.ERROR, error: err.message });
    }

    this.processNext();
  }

  async _saveUG(index, song, downloadChoice) {
    const chartData = song.chartData;
    const selectedType = song.selectedResult?.type;
    const versions = downloadChoice === 'both' ? ['current', 'alternate'] : ['current'];
    const savedFiles = [];

    for (const version of versions) {
      if (version === 'alternate') {
        const alternates = chartData?.alternateVersions || [];
        const targetType = selectedType === 'Chords' ? 'Tab' : 'Chords';
        const alternate = alternates.find((v) => v.type === targetType);

        if (!alternate) {
          console.warn(`No alternate ${targetType} version found`);
          continue;
        }

        await this.navigateAndWait(alternate.url);
        await pageDelay(this.preferences.delayMode);
      }

      const printResult = await this._triggerUGPrint();

      if (printResult.type === 'pdf_url' || printResult.type === 'pdf_tab') {
        const typeSuffix = version === 'alternate'
          ? (selectedType === 'Chords' ? ' (Tab)' : ' (Chords)')
          : (downloadChoice === 'both' ? ` (${selectedType})` : '');

        const result = await saveChartFromUrl({
          url: printResult.url,
          songIndex: index,
          artist: chartData.artist || song.artist,
          title: (chartData.title || song.title) + typeSuffix,
          playlistName: this.playlistName,
          preferences: this.preferences,
        });
        savedFiles.push(result);

        if (printResult.tabId) {
          try { await chrome.tabs.remove(printResult.tabId); } catch {}
        }
      } else if (printResult.type === 'print_dialog') {
        console.log('Print dialog triggered — user will save manually');
      } else {
        console.warn('Could not trigger print:', printResult.error);
      }

      if (versions.length > 1 && version !== versions[versions.length - 1]) {
        await humanDelay(2000, 4000);
      }
    }

    if (savedFiles.length > 0) {
      this.updateSong(index, { status: SONG_STATUS.SAVED, savedFile: savedFiles[0] });
    } else {
      this.updateSong(index, {
        status: SONG_STATUS.ERROR,
        error: 'Could not download PDF — print button may have triggered a print dialog instead',
      });
    }
  }

  // ── user actions ───────────────────────────────────────────────

  tryAnother() {
    this.updateSong(this.currentIndex, {
      status: SONG_STATUS.AWAITING_SELECTION,
      selectedResult: null,
      chartData: null,
    });
  }

  skipSong() {
    this.updateSong(this.currentIndex, { status: SONG_STATUS.SKIPPED });
    this.processNext();
  }

  pause() {
    this.paused = true;
    this.broadcastState();
  }

  resume() {
    this.paused = false;
    this.broadcastState();
    const current = this.queue[this.currentIndex];
    if (current && current.status === SONG_STATUS.SEARCHING) {
      this.searchAllSources(this.currentIndex, current);
    }
  }
}
