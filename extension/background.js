// Minimal by design post-pivot: the server (not this service worker) owns
// the API key and all network calls now. This only makes the action icon
// open the side panel.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
