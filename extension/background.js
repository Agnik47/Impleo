// Minimal by design: the side panel itself owns the API key and all network
// calls (calling providers directly, chrome.storage.local/IndexedDB for
// persistence) -- there is no server and no privileged owner of the key in
// this service worker. This only makes the action icon open the side panel.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
