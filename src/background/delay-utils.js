import { DELAY_CONFIGS } from '../shared/constants.js';

export function humanDelay(minMs, maxMs) {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export function getDelayConfig(mode = 'normal') {
  return DELAY_CONFIGS[mode] || DELAY_CONFIGS.normal;
}

export async function searchDelay(mode) {
  const config = getDelayConfig(mode);
  return humanDelay(config.searchMin, config.searchMax);
}

export async function pageDelay(mode) {
  const config = getDelayConfig(mode);
  return humanDelay(config.pageMin, config.pageMax);
}

export async function betweenSongsDelay(mode, queueSize) {
  const config = getDelayConfig(mode);
  // Scale up delay for larger playlists
  const multiplier = queueSize > 10 ? 2 : queueSize > 5 ? 1.5 : 1;
  return humanDelay(config.betweenSongs * multiplier, config.betweenSongs * multiplier * 1.5);
}
