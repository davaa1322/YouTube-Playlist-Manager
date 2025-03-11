chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    id: "addToPlaylist",
    title: "Add to YouTube Playlist",
    contexts: ["link"],
    targetUrlPatterns: ["*://*.youtube.com/watch*"],
  });
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === "addToPlaylist") {
    const url = info.linkUrl;
    const videoId = new URL(url).searchParams.get("v");
    const title = `YouTube Video (${videoId})`;

    chrome.storage.local.get("youtubeUrls", function (data) {
      const urls = data.youtubeUrls || [];

      // 重複チェック
      const isDuplicate = urls.some((item) => item.url === url);

      if (!isDuplicate) {
        urls.push({ url, title });
        chrome.storage.local.set({ youtubeUrls: urls }, function () {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "images/icon48.png",
            title: "YouTube Playlist Manager",
            message: "URL added to the playlist.",
          });
        });
      } else {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "images/icon48.png",
          title: "YouTube Playlist Manager",
          message: "This URL already exists in the playlist.",
        });
      }
    });
  }
});
