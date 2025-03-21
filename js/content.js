console.log("YouTube Playlist Manager - Content Script Loaded");

let videoElement = null;
let isSettingApplied = false;
let retryCount = 0;
const MAX_RETRY = 10;
let isAutoplayChecked = false;

function initializeExtension() {
  if (!window.location.href.includes("youtube.com/watch")) return;
  disableYoutubeAutoplay();
  findVideoElement();
}

function findVideoElement() {
  const observer = new MutationObserver((mutations, obs) => {
    if (!videoElement) {
      videoElement =
        document.querySelector("video") ||
        document.querySelector(".html5-main-video");
      if (videoElement) {
        setupVideoEndListener();
        applyPlaybackSettings();
        obs.disconnect();
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function disableYoutubeAutoplay() {
  if (isAutoplayChecked) return;
  isAutoplayChecked = true;
  const autoplayButton = document.querySelector(".ytp-autonav-toggle-button");
  if (
    autoplayButton &&
    autoplayButton.getAttribute("aria-checked") === "true"
  ) {
    autoplayButton.click();
  }
}

function setupVideoEndListener() {
  if (!videoElement) return;
  videoElement.removeEventListener("ended", handleVideoEnd);
  videoElement.addEventListener("ended", handleVideoEnd);
  videoElement.addEventListener("timeupdate", checkVideoNearEnd);
}

function checkVideoNearEnd() {
  if (!videoElement) return;
  const timeRemaining = videoElement.duration - videoElement.currentTime;
  if (timeRemaining < 1 && videoElement.duration > 0) {
    videoElement.removeEventListener("timeupdate", checkVideoNearEnd);
    setTimeout(handleVideoEnd, 500);
  }
}

function handleVideoEnd() {
  chrome.storage.local.get(
    ["youtubeUrls", "currentPlayIndex", "playedUrls"],
    function (data) {
      const urls = data.youtubeUrls || [];
      let currentIndex = data.currentPlayIndex;
      let playedUrls = data.playedUrls || [];
      if (typeof currentIndex === "number" && urls.length > 0) {
        const currentVideo = urls[currentIndex];
        playedUrls.push(currentVideo);
        if (playedUrls.length > 100) playedUrls.shift();
        urls.splice(currentIndex, 1);
        if (currentIndex < urls.length) {
          chrome.storage.local.set(
            {
              youtubeUrls: urls,
              playedUrls: playedUrls,
              currentPlayIndex: currentIndex,
            },
            function () {
              attemptNavigation(currentIndex, playedUrls, urls);
            }
          );
        } else {
          chrome.storage.local.set(
            { youtubeUrls: urls, playedUrls: playedUrls, currentPlayIndex: 0 },
            function () {
              checkAndPlayNextVideo();
            }
          );
        }
      }
    }
  );
}

function attemptNavigation(nextIndex, playedUrls, urls) {
  setTimeout(() => {
    chrome.storage.local.set(
      { currentPlayIndex: nextIndex, playedUrls: playedUrls },
      function () {
        const nextUrl = urls[nextIndex].url;
        history.pushState({}, "", nextUrl);
        window.dispatchEvent(new Event("popstate"));
        retryNavigation(nextUrl, nextIndex, playedUrls, urls);
      }
    );
  }, 500);
}

function retryNavigation(nextUrl, nextIndex, playedUrls, urls) {
  let retryAttempts = 0;
  const retryInterval = setInterval(() => {
    if (window.location.href.includes(nextUrl) || retryAttempts >= MAX_RETRY) {
      clearInterval(retryInterval);
    } else {
      history.pushState({}, "", nextUrl);
      window.dispatchEvent(new Event("popstate"));
      retryAttempts++;
    }
  }, 1000);
}

function applyPlaybackSettings() {
  if (!videoElement) return;
  chrome.storage.local.get(
    ["playbackSpeed", "volume", "youtubeUrls"],
    function (data) {
      const currentUrl = window.location.href;
      const isInPlaylist =
        data.youtubeUrls &&
        data.youtubeUrls.some(
          (item) => item.url && currentUrl.includes(item.url)
        );
      if (!isInPlaylist) return;
      if (data.playbackSpeed) {
        const speed = parseFloat(data.playbackSpeed);
        videoElement.playbackRate = speed;
        setTimeout(() => {
          if (Math.abs(videoElement.playbackRate - speed) > 0.01) {
            trySetPlaybackRateWithYoutubeAPI(speed);
          }
        }, 1000);
      }
      if (data.volume !== undefined) {
        videoElement.volume = parseInt(data.volume) / 100;
      }
      isSettingApplied = true;
    }
  );
}

function trySetPlaybackRateWithYoutubeAPI(speed) {
  try {
    if (window.yt && window.yt.player && window.yt.player.getPlayer) {
      const ytPlayer = window.yt.player.getPlayer();
      if (ytPlayer && ytPlayer.setPlaybackRate) {
        ytPlayer.setPlaybackRate(speed);
        return true;
      }
    }
    const videoPlayerElement = document.getElementById("movie_player");
    if (videoPlayerElement && videoPlayerElement.setPlaybackRate) {
      videoPlayerElement.setPlaybackRate(speed);
      return true;
    }
    const videoElem = document.querySelector("video");
    if (videoElem) {
      videoElem.playbackRate = speed;
      return true;
    }
  } catch (e) {
    console.error("Failed to set playback speed with YouTube API:", e);
  }
  return false;
}

chrome.storage.onChanged.addListener(function (changes, namespace) {
  if (namespace === "local" && (changes.playbackSpeed || changes.volume)) {
    setTimeout(applyPlaybackSettings, 100);
  }
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "applyPlaybackSettings") {
    const videoElement = document.querySelector("video");
    if (videoElement) {
      videoElement.playbackRate = message.playbackSpeed;
      videoElement.volume = message.volume / 100;
    }
  }
});

function setupYouTubeSPAListener() {
  document.addEventListener("yt-navigate-finish", function () {
    resetAndReinitialize();
    applyPlaybackSettings();
  });
  window.onpopstate = function () {
    resetAndReinitialize();
  };
}

function resetAndReinitialize() {
  videoElement = null;
  isSettingApplied = false;
  retryCount = 0;
  setTimeout(initializeExtension, 2000);
}

function monitorVideoState() {
  const videoElement = document.querySelector("video");
  if (videoElement) {
    const videoTitle = document.title.replace(" - YouTube", "");
    videoElement.addEventListener("play", function () {
      chrome.runtime.sendMessage({
        action: "setNowPlaying",
        videoTitle: videoTitle,
      });
    });
    videoElement.addEventListener("ended", function () {
      chrome.runtime.sendMessage({ action: "clearNowPlaying" });
    });
  }
}

function checkAndPlayNextVideo() {
  chrome.storage.local.get(
    ["youtubeUrls", "currentPlayIndex"],
    function (data) {
      const urls = data.youtubeUrls || [];
      const currentIndex = data.currentPlayIndex;
      if (typeof currentIndex === "number" && currentIndex < urls.length) {
        const nextUrl = urls[currentIndex].url;
        history.pushState({}, "", nextUrl);
        window.dispatchEvent(new Event("popstate"));
      }
    }
  );
}

document.addEventListener("DOMContentLoaded", function () {
  initializeExtension();
  setupYouTubeSPAListener();
});

document.addEventListener("yt-navigate-finish", () => {
  isAutoplayChecked = false;
  disableYoutubeAutoplay();
});

const observer = new MutationObserver(() => {
  disableYoutubeAutoplay();
});
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener("load", function () {
  if (!isSettingApplied) {
    initializeExtension();
  }
});
window.addEventListener("load", monitorVideoState);

setInterval(function () {
  if (window.location.href.includes("youtube.com/watch")) {
    if (!videoElement || !isSettingApplied) {
      initializeExtension();
    }
  }
}, 10000);

setTimeout(initializeExtension, 500);
