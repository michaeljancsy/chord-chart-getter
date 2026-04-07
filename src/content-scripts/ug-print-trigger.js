// Content script that clicks UG's print button.
// Injected on-demand when the user confirms a save on UG.
// The print button either:
//   - Opens a new tab with a rendered PDF (for chord charts)
//   - Triggers window.print() (for tabs)

(() => {
  const printBtn =
    document.querySelector('[class*="print" i]') ||
    document.querySelector('button[aria-label*="print" i]') ||
    document.querySelector('a[href*="print"]') ||
    document.querySelector('[data-action*="print"]');

  if (!printBtn) {
    chrome.runtime.sendMessage({
      type: 'ug_print_result',
      payload: { success: false, error: 'Print button not found' },
    });
    return;
  }

  // If it's a link with an href, report the URL instead of clicking
  if (printBtn.tagName === 'A' && printBtn.href) {
    chrome.runtime.sendMessage({
      type: 'ug_print_result',
      payload: { success: true, action: 'link', url: printBtn.href },
    });
    return;
  }

  // Otherwise click it — this will either open a new tab or trigger print dialog
  printBtn.click();

  chrome.runtime.sendMessage({
    type: 'ug_print_result',
    payload: { success: true, action: 'clicked' },
  });
})();
