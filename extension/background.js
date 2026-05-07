// Larry Route Planner - Extension Background Script

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Larry Extension: Installed', details);
  
  if (details.reason === 'install') {
    // Open welcome page
    chrome.tabs.create({
      url: 'https://platform.trans.eu'
    });
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Larry Extension: Background received message', message);
  
  switch (message.type) {
    case 'GET_TAB_INFO':
      // Return information about the current tab
      sendResponse({
        tabId: sender.tab?.id,
        url: sender.tab?.url,
        title: sender.tab?.title
      });
      break;
      
    default:
      console.log('Larry Extension: Unknown message type', message.type);
  }
  
  return true; // Keep message channel open for async response
});

// Handle browser action click - just navigate to Trans.eu if not there
chrome.action.onClicked.addListener((tab) => {
  if (!tab.url || !tab.url.includes('trans.eu')) {
    // Navigate to Trans.eu where the floating button will appear
    chrome.tabs.update(tab.id, {
      url: 'https://platform.trans.eu'
    });
  }
  // If already on Trans.eu, do nothing - user should use the floating button
});