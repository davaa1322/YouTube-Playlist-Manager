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
    let title = `YouTube Video (${videoId})`;
    let thumbnail_url = "";

    chrome.storage.local.get("youtubeUrls", function (data) {
      const urls = data.youtubeUrls || [];

      // Check duplicate
      const isDuplicate = urls.some((item) => item.url === url);

      if (!isDuplicate) {
        getYouTubeInfo(url).then((info) => {
          if (info) {
            title = info.title;
            thumbnail_url = info.thumbnail_url;
          } else {
            title = `YouTube Video (${videoId})`;
          }
        });

        urls.push({ url, title, thumbnail_url });
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

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "setNowPlaying") {
    chrome.storage.local.set({ nowPlaying: message.videoTitle });
  } else if (message.action === "clearNowPlaying") {
    chrome.storage.local.remove("nowPlaying");
  }
});
