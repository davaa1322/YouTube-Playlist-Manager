document.addEventListener("DOMContentLoaded", function () {
  // 動画要素を監視
  let videoElement = document.querySelector("video");

  // 最初はビデオ要素がない場合があるので監視する
  const observer = new MutationObserver(function (mutations) {
    if (!videoElement) {
      videoElement = document.querySelector("video");
      if (videoElement) {
        setupVideoEndListener();
        applyPlaybackSettings();
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // すでにビデオ要素がある場合
  if (videoElement) {
    setupVideoEndListener();
    applyPlaybackSettings();
  }

  // 新しい動画が読み込まれたときにも設定を適用
  window.addEventListener("yt-navigate-finish", function () {
    // YouTubeのSPAナビゲーション後に実行
    setTimeout(function () {
      videoElement = document.querySelector("video");
      if (videoElement) {
        applyPlaybackSettings();
      }
    }, 1000); // YouTubeのプレーヤーが読み込まれるのを待つ
  });

  // 再生設定を適用する関数
  function applyPlaybackSettings() {
    chrome.storage.local.get(["playbackSpeed", "volume"], function (data) {
      if (videoElement) {
        // 再生速度の設定
        if (data.playbackSpeed) {
          videoElement.playbackRate = data.playbackSpeed;
        }

        // 音量の設定
        if (data.volume !== undefined) {
          videoElement.volume = data.volume / 100;
        }
      }
    });
  }

  function setupVideoEndListener() {
    videoElement.addEventListener("ended", function () {
      chrome.storage.local.get(
        ["youtubeUrls", "currentPlayIndex"],
        function (data) {
          const urls = data.youtubeUrls || [];
          let currentIndex = data.currentPlayIndex;

          if (typeof currentIndex === "number" && urls.length > 0) {
            // 次の動画のインデックス
            const nextIndex = currentIndex + 1;

            // リストの範囲内であれば次の動画を再生
            if (nextIndex < urls.length) {
              chrome.storage.local.set(
                { currentPlayIndex: nextIndex },
                function () {
                  window.location.href = urls[nextIndex].url;
                }
              );
            }
          }
        }
      );
    });
  }

  // 設定変更を監視して適用
  chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === "local") {
      if (changes.playbackSpeed || changes.volume) {
        applyPlaybackSettings();
      }
    }
  });
});
