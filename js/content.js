// YouTubeの動画プレーヤーを制御するためのcontent.js
console.log("YouTube Playlist Manager - Content Script Loaded");

// グローバル変数
let videoElement = null;
let isSettingApplied = false;
let retryCount = 0;
const MAX_RETRY = 10;

// 初期化関数
function initializeExtension() {
  console.log("Starts initializing the extension.");

  // 現在のURLがYouTube動画ページかどうかをチェック
  if (!window.location.href.includes("youtube.com/watch")) {
    console.log("This is not a YouTube video page. Skip initialization.");
    return;
  }

  // YouTubeの自動再生を無効化
  disableYoutubeAutoplay();

  // ビデオ要素を取得
  findVideoElement();
}

// ビデオ要素を見つける関数
function findVideoElement() {
  console.log("Searching for videos...");

  // 複数のセレクタを試して確実に見つける
  videoElement =
    document.querySelector("video") ||
    document.querySelector(".html5-main-video") ||
    document.getElementsByTagName("video")[0];

  if (videoElement) {
    console.log("Video found:", videoElement);
    setupVideoEndListener();
    applyPlaybackSettings();
  } else {
    retryCount++;
    if (retryCount < MAX_RETRY) {
      console.log(`Video element not found. Retry ${retryCount}/${MAX_RETRY}`);
      setTimeout(findVideoElement, 1000);
    } else {
      console.error(
        "Gives up searching for video. The maximum number of retries has been reached."
      );
    }
  }
}

// YouTubeの自動再生機能を無効化する
function disableYoutubeAutoplay() {
  console.log("Trying to disable YouTube autoplay feature...");

  const checkAndDisable = () => {
    const autoplayToggle = document.querySelector(".ytp-autonav-toggle-button");
    if (autoplayToggle) {
      if (autoplayToggle.getAttribute("aria-checked") === "true") {
        try {
          autoplayToggle.click();
          console.log("YouTube autoplay has been disabled.");
        } catch (e) {
          console.error("Failed to disable autoplay:", e);
        }
      } else {
        console.log("YouTube autoplay is already disabled");
      }
    } else {
      console.log("I can't find the autoplay button.");
    }
  };

  // すぐに実行してみる
  checkAndDisable();

  // 少し遅延させて再度試行（DOMが完全に読み込まれるのを待つ）
  setTimeout(checkAndDisable, 3000);
}

// ビデオ終了イベントリスナーの設定
function setupVideoEndListener() {
  if (!videoElement) {
    console.error(
      "No event listener can be set because there is no video element."
    );
    return;
  }

  // 既存のリスナーを削除して重複を防止
  videoElement.removeEventListener("ended", handleVideoEnd);
  videoElement.addEventListener("ended", handleVideoEnd);
  console.log("End-of-video event listener set up.");

  // 念のため、timeupdate イベントでも終了を検知
  videoElement.addEventListener("timeupdate", checkVideoNearEnd);
}

// ビデオが終了に近づいているかチェック
function checkVideoNearEnd() {
  if (!videoElement) return;

  // ビデオの残り時間が1秒未満になったら終了とみなす
  const timeRemaining = videoElement.duration - videoElement.currentTime;
  if (timeRemaining < 1 && videoElement.duration > 0) {
    videoElement.removeEventListener("timeupdate", checkVideoNearEnd);
    console.log("Video is nearing its end. Prepare for the next video.");

    // 少し遅延させて次のビデオに移動（YouTubeの自動処理を回避）
    setTimeout(handleVideoEnd, 500);
  }
}

// ビデオ終了時の処理
function handleVideoEnd() {
  console.log("End of video event has been fired.");

  chrome.storage.local.get(
    ["youtubeUrls", "currentPlayIndex"],
    function (data) {
      console.log("Acquired data:", data);

      const urls = data.youtubeUrls || [];
      let currentIndex = data.currentPlayIndex;

      if (typeof currentIndex === "number" && urls.length > 0) {
        // 次の動画のインデックス
        const nextIndex = currentIndex + 1;
        console.log(`Next: ${nextIndex} / All ${urls.length}`);

        if (nextIndex < urls.length) {
          // 確実に次のビデオに移動するために少し遅延させる
          setTimeout(function () {
            try {
              chrome.storage.local.set(
                { currentPlayIndex: nextIndex },
                function () {
                  const nextUrl = urls[nextIndex].url;
                  console.log("Go to the following URL:", nextUrl);

                  // YouTubeの自動再生よりも優先するため、直接location.hrefを変更
                  window.location.href = nextUrl;
                }
              );
            } catch (e) {
              console.error(
                "An error occurred while navigating to the next video:",
                e
              );
            }
          }, 500);
        } else {
          console.log("You have reached the end of the playlist.");
        }
      } else {
        console.log("No valid playlist data:", data);
      }
    }
  );
}

// 再生設定（速度、音量）を適用する
function applyPlaybackSettings() {
  if (!videoElement) {
    console.error(
      "Playback settings cannot be applied due to missing video elements"
    );
    return;
  }

  chrome.storage.local.get(["playbackSpeed", "volume"], function (data) {
    console.log("Settings to apply:", data);

    // 再生速度の設定
    if (data.playbackSpeed) {
      try {
        const speed = parseFloat(data.playbackSpeed);
        videoElement.playbackRate = speed;
        console.log("Playback speed is set:", speed);

        // 設定が適用されたか確認
        setTimeout(() => {
          console.log("Current playback speed:", videoElement.playbackRate);
          if (Math.abs(videoElement.playbackRate - speed) > 0.01) {
            console.warn("Playback speed setting may not be applied.");
            trySetPlaybackRateWithYoutubeAPI(speed);
          }
        }, 1000);
      } catch (e) {
        console.error("An error occurred while setting the playback speed:", e);
      }
    }

    // 音量の設定
    if (data.volume !== undefined) {
      try {
        const vol = parseInt(data.volume) / 100;
        videoElement.volume = vol;
        console.log("Volume set.:", vol);
      } catch (e) {
        console.error("An error occurred while setting the volume:", e);
      }
    }

    isSettingApplied = true;
  });
}

// YouTube APIを使用して再生速度を設定する代替方法
function trySetPlaybackRateWithYoutubeAPI(speed) {
  console.log("YouTube Trying to set playback speed with YouTube API...");

  try {
    // YouTubeプレーヤーインスタンスにアクセスする方法1
    if (window.yt && window.yt.player && window.yt.player.getPlayer) {
      const ytPlayer = window.yt.player.getPlayer();
      if (ytPlayer && ytPlayer.setPlaybackRate) {
        ytPlayer.setPlaybackRate(speed);
        console.log(
          "YouTube Playback speed set by YouTube API (Method 1):",
          speed
        );
        return true;
      }
    }

    // YouTubeプレーヤーインスタンスにアクセスする方法2
    const videoPlayerElement = document.getElementById("movie_player");
    if (videoPlayerElement && videoPlayerElement.setPlaybackRate) {
      videoPlayerElement.setPlaybackRate(speed);
      console.log("YouTube API set playback speed (Method 2):", speed);
      return true;
    }

    // JavaScript経由でHTML5ビデオを直接制御する方法3
    if (document.querySelector("video")) {
      const videoElem = document.querySelector("video");
      videoElem.playbackRate = speed;
      console.log("HTML5 video element with playback speed (Method 3):", speed);
      return true;
    }
  } catch (e) {
    console.error("YouTube Failed to set playback speed with YouTube API:", e);
  }

  return false;
}

// 設定変更を監視
chrome.storage.onChanged.addListener(function (changes, namespace) {
  if (namespace === "local") {
    console.log("Detect storage changes:", changes);

    if (changes.playbackSpeed || changes.volume) {
      console.log(
        "Playback settings have been changed. Apply the new settings."
      );
      setTimeout(applyPlaybackSettings, 100); // 少し遅延させて適用
    }
  }
});

// YouTubeのSPA（Single Page Application）ナビゲーションを検出
function setupYouTubeSPAListener() {
  console.log("Set up a SPA navigation listener for YouTube.");

  // 方法1: YouTube固有のナビゲーションイベント
  document.addEventListener("yt-navigate-finish", function () {
    console.log("YouTube SPA navigation detected (yt-navigate-finish)");
    resetAndReinitialize();
  });

  // 方法2: 履歴APIの変更を監視
  const originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(this, arguments);
    console.log("Detected history changes (pushState)");

    if (window.location.href.includes("youtube.com/watch")) {
      resetAndReinitialize();
    }
  };

  // 方法3: URLが変わったことを検出
  let lastUrl = window.location.href;
  setInterval(function () {
    if (lastUrl !== window.location.href) {
      console.log("URL change detected:", window.location.href);
      lastUrl = window.location.href;

      if (window.location.href.includes("youtube.com/watch")) {
        resetAndReinitialize();
      }
    }
  }, 1000);
}

// 状態をリセットして再初期化
function resetAndReinitialize() {
  console.log("Reset and reinitialize the state of the extension...");
  videoElement = null;
  isSettingApplied = false;
  retryCount = 0;

  // 少し遅延させて再初期化
  setTimeout(initializeExtension, 1000);
}

// 拡張機能の初期化
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOMContentLoaded Start");
  initializeExtension();
  setupYouTubeSPAListener();
});

// ページが完全に読み込まれた場合にも初期化
window.addEventListener("load", function () {
  console.log("Load");
  if (!isSettingApplied) {
    console.log("Setting applied");
    initializeExtension();
  }
});

// 定期的にビデオ要素と設定の状態をチェック（バックアップ措置）
setInterval(function () {
  if (window.location.href.includes("youtube.com/watch")) {
    if (!videoElement || !isSettingApplied) {
      console.log("Reinitialize video elements or settings not yet applied");
      initializeExtension();
    }
  }
}, 10000);

// 初期化を開始
console.log("Start console.js");
setTimeout(initializeExtension, 500);
