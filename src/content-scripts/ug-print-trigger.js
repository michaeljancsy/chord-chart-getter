// Content script that clicks UG's "Download PDF" or "Print" button.
// Injected on-demand when the user confirms a save on UG.
// The button either:
//   - Triggers a PDF download (Download PDF button)
//   - Triggers window.print() or opens a new tab (Print button)

(() => {
  function findButton() {
    // UG uses obfuscated class names, so we match by visible text content.
    // Look for buttons whose text includes "Download PDF" or "Print".
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim();
      if (text === 'Download PDF') return { el: btn, action: 'download_pdf' };
    }
    for (const btn of buttons) {
      const text = btn.textContent?.trim();
      if (text === 'Print') return { el: btn, action: 'print' };
    }
    return null;
  }

  const match = findButton();

  if (!match) {
    chrome.runtime.sendMessage({
      type: 'ug_print_result',
      payload: { success: false, error: 'Download PDF / Print button not found' },
    });
    return;
  }

  match.el.click();

  chrome.runtime.sendMessage({
    type: 'ug_print_result',
    payload: { success: true, action: match.action },
  });
})();
