// Mock chrome.* APIs for testing.
// Call createChromeMock() to get a fresh mock; assign to globalThis.chrome.

import { vi } from 'vitest';

export function createChromeMock() {
  const listeners = {
    tabsOnUpdated: [],
    tabsOnCreated: [],
    downloadsOnChanged: [],
    downloadsOnCreated: [],
    runtimeOnMessage: [],
  };

  const chrome = {
    tabs: {
      create: vi.fn(async (opts) => ({ id: 100, url: opts?.url || 'about:blank', ...opts })),
      get: vi.fn(async (id) => ({ id, url: 'about:blank', status: 'complete' })),
      update: vi.fn(async (id, opts) => ({ id, ...opts })),
      remove: vi.fn(async () => {}),
      captureVisibleTab: vi.fn(async () => 'data:image/png;base64,fake'),
      onUpdated: {
        addListener: vi.fn((fn) => listeners.tabsOnUpdated.push(fn)),
        removeListener: vi.fn((fn) => {
          const i = listeners.tabsOnUpdated.indexOf(fn);
          if (i >= 0) listeners.tabsOnUpdated.splice(i, 1);
        }),
      },
      onCreated: {
        addListener: vi.fn((fn) => listeners.tabsOnCreated.push(fn)),
        removeListener: vi.fn((fn) => {
          const i = listeners.tabsOnCreated.indexOf(fn);
          if (i >= 0) listeners.tabsOnCreated.splice(i, 1);
        }),
      },
    },
    scripting: {
      executeScript: vi.fn(async () => []),
    },
    downloads: {
      download: vi.fn(async () => 1),
      onChanged: {
        addListener: vi.fn((fn) => listeners.downloadsOnChanged.push(fn)),
        removeListener: vi.fn((fn) => {
          const i = listeners.downloadsOnChanged.indexOf(fn);
          if (i >= 0) listeners.downloadsOnChanged.splice(i, 1);
        }),
      },
      onCreated: {
        addListener: vi.fn((fn) => listeners.downloadsOnCreated.push(fn)),
        removeListener: vi.fn((fn) => {
          const i = listeners.downloadsOnCreated.indexOf(fn);
          if (i >= 0) listeners.downloadsOnCreated.splice(i, 1);
        }),
      },
    },
    runtime: {
      sendMessage: vi.fn(async () => {}),
      onMessage: {
        addListener: vi.fn((fn) => listeners.runtimeOnMessage.push(fn)),
        removeListener: vi.fn((fn) => {
          const i = listeners.runtimeOnMessage.indexOf(fn);
          if (i >= 0) listeners.runtimeOnMessage.splice(i, 1);
        }),
      },
    },
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => {}),
      },
    },
  };

  return { chrome, listeners };
}
