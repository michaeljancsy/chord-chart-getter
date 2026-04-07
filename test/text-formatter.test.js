import { describe, it, expect } from 'vitest';
import { makeFilename, formatUGContent } from '../src/shared/formatters/text-formatter.js';

describe('makeFilename', () => {
  it('formats with zero-padded index', () => {
    expect(makeFilename(0, 'Radiohead', 'Creep', 'pdf')).toBe('01 - Radiohead - Creep.pdf');
    expect(makeFilename(9, 'Artist', 'Title', 'txt')).toBe('10 - Artist - Title.txt');
  });

  it('sanitizes special characters', () => {
    expect(makeFilename(0, 'AC/DC', 'What?', 'pdf')).toBe('01 - AC-DC - What-.pdf');
  });

  it('collapses whitespace', () => {
    expect(makeFilename(0, 'The   Band', 'Some    Song', 'pdf')).toBe('01 - The Band - Some Song.pdf');
  });

  it('defaults to txt extension', () => {
    expect(makeFilename(0, 'A', 'B')).toBe('01 - A - B.txt');
  });
});

describe('formatUGContent', () => {
  it('strips [ch] tags', () => {
    const result = formatUGContent({
      title: 'Song',
      artist: 'Artist',
      type: 'Chords',
      content: '[ch]Am[/ch] [ch]G[/ch] [ch]F[/ch]',
    });
    expect(result).toContain('Am G F');
    expect(result).not.toContain('[ch]');
  });

  it('strips [tab] tags', () => {
    const result = formatUGContent({
      title: 'Song',
      artist: 'Artist',
      type: 'Tab',
      content: '[tab]e|---0---|[/tab]',
    });
    expect(result).toContain('e|---0---|');
    expect(result).not.toContain('[tab]');
  });

  it('includes capo info when present', () => {
    const result = formatUGContent({
      title: 'Song',
      artist: 'Artist',
      type: 'Chords',
      content: '',
      capo: 3,
    });
    expect(result).toContain('Capo: fret 3');
  });

  it('omits capo line when capo is 0', () => {
    const result = formatUGContent({
      title: 'Song',
      artist: 'Artist',
      type: 'Chords',
      content: '',
      capo: 0,
    });
    expect(result).not.toContain('Capo');
  });
});
