import { formatChordifyContent, makeFilename } from '../shared/formatters/text-formatter.js';
import { generatePDF } from '../shared/formatters/pdf-formatter.js';

function sanitizeFolderName(name) {
  return name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim();
}

/**
 * Download a file and wait for completion.
 */
function downloadAndWait(downloadOptions) {
  return new Promise(async (resolve, reject) => {
    const downloadId = await chrome.downloads.download(downloadOptions);

    function listener(delta) {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === 'complete') {
        chrome.downloads.onChanged.removeListener(listener);
        resolve({ downloadId, filename: downloadOptions.filename });
      } else if (delta.error) {
        chrome.downloads.onChanged.removeListener(listener);
        reject(new Error(delta.error.current));
      }
    }
    chrome.downloads.onChanged.addListener(listener);

    // Safety timeout
    setTimeout(() => {
      chrome.downloads.onChanged.removeListener(listener);
      resolve({ downloadId, filename: downloadOptions.filename, timedOut: true });
    }, 30000);
  });
}

/**
 * Save a chart from a direct URL (e.g., UG's print PDF URL).
 */
export async function saveChartFromUrl({ url, songIndex, artist, title, playlistName, preferences }) {
  const folderBase = preferences.folderName || 'ChordCharts';
  const folder = `${folderBase}/${sanitizeFolderName(playlistName)}`;
  const filename = makeFilename(songIndex, artist, title, 'pdf');

  const result = await downloadAndWait({
    url,
    filename: `${folder}/${filename}`,
    saveAs: false,
    conflictAction: 'uniquify',
  });

  return { ...result, folder };
}

/**
 * Save a chart from extracted content (for Chordify, Songsterr, or fallback).
 */
export async function saveChart({ chartData, songIndex, playlistName, preferences }) {
  const folderBase = preferences.folderName || 'ChordCharts';
  const folder = `${folderBase}/${sanitizeFolderName(playlistName)}`;
  const format = preferences.outputFormat || 'txt';

  let content;
  let filename;
  let mimeType;

  if (chartData.source === 'chordify') {
    const text = formatChordifyContent(chartData);
    if (format === 'pdf') {
      content = generatePDF(text, `${chartData.title} - ${chartData.artist}`);
      filename = makeFilename(songIndex, chartData.artist, chartData.title, 'pdf');
      mimeType = 'application/pdf';
    } else {
      content = text;
      filename = makeFilename(songIndex, chartData.artist, chartData.title, 'txt');
      mimeType = 'text/plain';
    }
  } else if (chartData.source === 'songsterr') {
    if (chartData.screenshotDataUrl) {
      const response = await fetch(chartData.screenshotDataUrl);
      content = await response.arrayBuffer();
      filename = makeFilename(songIndex, chartData.artist, chartData.title, 'png');
      mimeType = 'image/png';
    } else {
      content = `[InternetShortcut]\nURL=${chartData.url}\n`;
      filename = makeFilename(songIndex, chartData.artist, chartData.title, 'url');
      mimeType = 'text/plain';
    }
  } else {
    // Fallback for any source — save raw content as text
    content = chartData.content || 'No content available';
    filename = makeFilename(songIndex, chartData.artist || 'Unknown', chartData.title || 'Unknown', 'txt');
    mimeType = 'text/plain';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const result = await downloadAndWait({
    url,
    filename: `${folder}/${filename}`,
    saveAs: false,
    conflictAction: 'uniquify',
  });

  URL.revokeObjectURL(url);
  return { ...result, folder };
}

/**
 * Capture a screenshot of the visible tab area (for Songsterr)
 */
export async function captureTabScreenshot() {
  const dataUrl = await chrome.tabs.captureVisibleTab(null, {
    format: 'png',
    quality: 100,
  });
  return dataUrl;
}
