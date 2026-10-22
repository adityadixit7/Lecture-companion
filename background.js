
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab.id) {
      throw new Error("No active tab found.");
    }

    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error("Could not open study panel:", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "CAPTURE_VISIBLE_TAB") {
    return;
  }

  (async () => {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      });

      const tab = tabs[0];

      if (!tab) {
        throw new Error("No active tab found.");
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(
        tab.windowId,
        { format: "jpeg", quality: 82 }
      );

      sendResponse({
        ok: true,
        dataUrl,
        tabTitle: tab.title || "Current tab",
        tabUrl: tab.url || ""
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error?.message || String(error)
      });
    }
  })();

  return true;
});
