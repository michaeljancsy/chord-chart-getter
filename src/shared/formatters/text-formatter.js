/**
 * Format Ultimate Guitar tab content into clean text
 */
export function formatUGContent(tabData) {
  let text = tabData.content || '';

  // Strip [ch] tags, keeping inner text
  text = text.replace(/\[ch\](.*?)\[\/ch\]/g, '$1');
  // Strip [tab] tags, keeping inner text
  text = text.replace(/\[tab\](.*?)\[\/tab\]/gs, '$1');
  // Strip any remaining bracket tags
  text = text.replace(/\[\/?(?:verse|chorus|intro|outro|bridge|solo|pre-chorus|interlude)\]/gi, '');

  const header = [
    `${tabData.title} - ${tabData.artist}`,
    `Type: ${tabData.type}`,
    `Source: Ultimate Guitar`,
    tabData.capo ? `Capo: fret ${tabData.capo}` : null,
    tabData.tuning ? `Tuning: ${tabData.tuning}` : null,
    '',
    '='.repeat(50),
    '',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return header + text;
}

/**
 * Format Chordify chord data into clean text
 */
export function formatChordifyContent(chordData) {
  const header = [
    `${chordData.title || 'Unknown'} - ${chordData.artist || 'Unknown'}`,
    `Source: Chordify`,
    '',
    '='.repeat(50),
    '',
  ].join('\n');

  let body = '';
  if (chordData.sections && chordData.sections.length > 0) {
    body = chordData.sections
      .map((section) => {
        const sectionHeader = section.name ? `[${section.name}]` : '';
        const chords = section.chords ? section.chords.join('  |  ') : '';
        return [sectionHeader, chords, ''].filter(Boolean).join('\n');
      })
      .join('\n');
  } else if (chordData.chordSequence && chordData.chordSequence.length > 0) {
    // Simple chord sequence without sections
    const chunked = [];
    for (let i = 0; i < chordData.chordSequence.length; i += 8) {
      chunked.push(chordData.chordSequence.slice(i, i + 8).join('  |  '));
    }
    body = chunked.join('\n');
  } else {
    body = '(No chord data extracted)';
  }

  return header + body;
}

/**
 * Generate a filename for a saved chart
 */
export function makeFilename(index, artist, title, ext = 'txt') {
  const num = String(index + 1).padStart(2, '0');
  const clean = (str) =>
    str
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  return `${num} - ${clean(artist)} - ${clean(title)}.${ext}`;
}
