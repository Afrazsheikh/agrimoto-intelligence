document.addEventListener('DOMContentLoaded', () => {
  const meeshoBtn = document.getElementById('open-meesho');
  const webappBtn = document.getElementById('open-webapp');

  if (meeshoBtn) {
    meeshoBtn.onclick = () => {
      chrome.tabs.create({ url: 'https://www.meesho.com' });
    };
  }

  if (webappBtn) {
    webappBtn.onclick = () => {
      chrome.tabs.create({ url: 'http://localhost:5173' });
    };
  }
});
