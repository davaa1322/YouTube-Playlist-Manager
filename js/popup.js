document.addEventListener("DOMContentLoaded", function () {
  const urlList = document.getElementById("url-list");
  const urlInput = document.getElementById("url-input");
  const addUrlButton = document.getElementById("add-url");
  const addCurrentButton = document.getElementById("add-current");
  const playButton = document.getElementById("play-button");
  const playbackSpeed = document.getElementById("playback-speed");
  const speedValue = document.getElementById("speed-value");
  const volume = document.getElementById("volume");
  const volumeValue = document.getElementById("volume-value");

  // 再生設定の初期化
  chrome.storage.local.get(["playbackSpeed", "volume"], function (data) {
    if (data.playbackSpeed) {
      playbackSpeed.value = data.playbackSpeed;
      speedValue.textContent = data.playbackSpeed.toFixed(2) + "x";
    }

    if (data.volume) {
      volume.value = data.volume;
      volumeValue.textContent = data.volume + "%";
    }
  });

  // 再生速度の変更イベント
  playbackSpeed.addEventListener("input", function () {
    const speed = parseFloat(playbackSpeed.value);
    speedValue.textContent = speed.toFixed(2) + "x";
    chrome.storage.local.set({ playbackSpeed: speed });
  });

  // 音量の変更イベント
  volume.addEventListener("input", function () {
    const vol = parseInt(volume.value);
    volumeValue.textContent = vol + "%";
    chrome.storage.local.set({ volume: vol });
  });

  // URLリストを読み込む
  loadUrls();

  // 現在のURLを追加ボタンのクリックイベント
  addCurrentButton.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentUrl = tabs[0].url;
      const currentTitle = tabs[0].title;

      if (currentUrl.includes("youtube.com/watch")) {
        addUrlToList(currentUrl, currentTitle);
      } else {
        alert("This Page is not Youtube.");
      }
    });
  });

  // URL追加ボタンのクリックイベント
  addUrlButton.addEventListener("click", function () {
    const url = urlInput.value.trim();

    if (url && url.includes("youtube.com/watch")) {
      // YouTubeのURLからタイトルを取得するのは困難なので、URLの一部を表示
      const videoId = new URL(url).searchParams.get("v");
      const title = `YouTube Video (${videoId})`;
      addUrlToList(url, title);
      urlInput.value = "";
    } else {
      alert("Please enter a valid YouTube video URL.");
    }
  });

  // 再生開始ボタンのクリックイベント
  playButton.addEventListener("click", function () {
    chrome.storage.local.get("youtubeUrls", function (data) {
      const urls = data.youtubeUrls || [];

      if (urls.length > 0) {
        // 最初のURLを再生
        chrome.tabs.create({ url: urls[0].url });

        // 現在再生中のインデックスを保存
        chrome.storage.local.set({ currentPlayIndex: 0 });
      } else {
        alert("There are no URLs to play.");
      }
    });
  });

  // URLをリストに追加する関数
  function addUrlToList(url, title) {
    chrome.storage.local.get("youtubeUrls", function (data) {
      const urls = data.youtubeUrls || [];

      // 重複チェック
      const isDuplicate = urls.some((item) => item.url === url);

      if (!isDuplicate) {
        urls.push({ url, title });
        chrome.storage.local.set({ youtubeUrls: urls }, function () {
          loadUrls();
        });
      } else {
        alert("This URL already exists in the list.");
      }
    });
  }

  // 保存されたURLリストを表示する関数
  function loadUrls() {
    chrome.storage.local.get("youtubeUrls", function (data) {
      const urls = data.youtubeUrls || [];
      urlList.innerHTML = "";

      if (urls.length === 0) {
        urlList.innerHTML = "<p>There are no saved URLs.</p>";
        return;
      }

      urls.forEach((item, index) => {
        const urlItem = document.createElement("div");
        urlItem.className = "url-item";

        const urlTitle = document.createElement("div");
        urlTitle.className = "url-title";
        urlTitle.textContent = item.title;
        urlTitle.title = item.url;

        const playButton = document.createElement("play-button");
        playButton.textContent = "Play";
        playButton.addEventListener("click", function () {
          chrome.tabs.create({ url: item.url });
          chrome.storage.local.set({ currentPlayIndex: index });
        });

        const removeButton = document.createElement("button");
        removeButton.textContent = "Delete";
        removeButton.addEventListener("click", function () {
          urls.splice(index, 1);
          chrome.storage.local.set({ youtubeUrls: urls }, function () {
            loadUrls();
          });
        });

        urlItem.appendChild(urlTitle);
        urlItem.appendChild(playButton);
        urlItem.appendChild(removeButton);
        urlList.appendChild(urlItem);
      });
    });
  }
});
