document.addEventListener("DOMContentLoaded", function () {
  const urlList = document.getElementById("url-list");
  const playedUrlList = document.getElementById("played-url-list");
  const urlInput = document.getElementById("url-input");
  const addUrlButton = document.getElementById("add-url");
  const addCurrentButton = document.getElementById("add-current");
  const playButton = document.getElementById("play-button");
  const playbackSpeed = document.getElementById("playback-speed");
  const speedValue = document.getElementById("speed-value");
  const volume = document.getElementById("volume");
  const volumeValue = document.getElementById("volume-value");
  const togglePlayedUrlsButton = document.getElementById("toggle-played-urls");
  const clearPlaylistButton = document.getElementById("clear-playlist");
  const clearPlayedUrlsButton = document.getElementById("clear-played-urls");
  const currentVideoElement = document.getElementById("current-video");

  initializeSettings();
  loadUrls();
  loadPlayedUrls();

  addCurrentButton.addEventListener("click", addCurrentUrl);
  addUrlButton.addEventListener("click", addUrl);
  playButton.addEventListener("click", playNextUrl);
  togglePlayedUrlsButton.addEventListener("click", togglePlayedUrls);
  clearPlaylistButton.addEventListener("click", clearPlaylist);
  clearPlayedUrlsButton.addEventListener("click", clearPlayedUrls);

  playbackSpeed.addEventListener("input", updatePlaybackSpeed);
  volume.addEventListener("input", updateVolume);

  function initializeSettings() {
    chrome.storage.local.get(
      ["playbackSpeed", "volume", "nowPlaying"],
      function (data) {
        if (data.playbackSpeed) {
          playbackSpeed.value = data.playbackSpeed;
          speedValue.textContent = data.playbackSpeed.toFixed(2) + "x";
        }
        if (data.volume) {
          volume.value = data.volume;
          volumeValue.textContent = data.volume + "%";
        }
        currentVideoElement.textContent = data.nowPlaying || "No video playing";
      }
    );
  }

  function addCurrentUrl() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const currentUrl = tabs[0].url;
      const currentTitle = tabs[0].title;
      if (currentUrl.includes("youtube.com/watch")) {
        addUrlToList(currentUrl, currentTitle, "");
      } else {
        alert("This Page is not Youtube.");
      }
    });
  }

  function addUrl() {
    const url = urlInput.value.trim();

    if (url && url.includes("youtube.com/watch")) {
      const videoId = new URL(url).searchParams.get("v");
      let title = "";
      let thumbnail_url = "";
      getYouTubeInfo(youtubeUrl).then((info) => {
        if (info) {
          title = info.title;
          thumbnail_url = info.thumbnail_url;
        } else {
          title = `YouTube Video (${videoId})`;
        }
      });
      addUrlToList(url, title, thumbnail_url);
      urlInput.value = "";
    } else {
      alert("Please enter a valid YouTube video URL.");
    }
  }

  function getYouTubeInfo(videoUrl) {
    const apiUrl = `https://www.youtube.com/oembed?url=${videoUrl}&format=json`;

    return fetch(apiUrl)
      .then((response) => response.json())
      .then((data) => ({
        title: data.title,
        thumbnail_url: data.thumbnail_url,
      }))
      .catch((error) => {
        console.error("Error fetching video info:", error);
        return null;
      });
  }

  function playNextUrl() {
    chrome.storage.local.get(
      ["youtubeUrls", "playbackSpeed", "volume"],
      function (data) {
        const urls = data.youtubeUrls || [];
        if (urls.length > 0) {
          chrome.tabs.create({ url: urls[0].url }, function (tab) {
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, {
                action: "applyPlaybackSettings",
                playbackSpeed: data.playbackSpeed || 1.0,
                volume: data.volume || 100,
              });
            }, 3000);
          });
          chrome.storage.local.set({ currentPlayIndex: 0 });
          addPlayedUrl(urls[0].url, urls[0].title);
          urls.shift();
          chrome.storage.local.set({ youtubeUrls: urls }, loadUrls);
        } else {
          alert("There are no URLs to play.");
        }
      }
    );
  }

  function togglePlayedUrls() {
    playedUrlList.style.display =
      playedUrlList.style.display === "none" ? "block" : "none";
  }

  function clearPlaylist() {
    chrome.storage.local.set({ youtubeUrls: [] }, loadUrls);
  }

  function clearPlayedUrls() {
    chrome.storage.local.set({ playedUrls: [] }, loadPlayedUrls);
  }

  function updatePlaybackSpeed() {
    const speed = parseFloat(playbackSpeed.value);
    speedValue.textContent = speed.toFixed(2) + "x";
    chrome.storage.local.set({ playbackSpeed: speed });
  }

  function updateVolume() {
    const vol = parseInt(volume.value);
    volumeValue.textContent = vol + "%";
    chrome.storage.local.set({ volume: vol });
  }

  function addUrlToList(url, title, thumbnail_url) {
    chrome.storage.local.get("youtubeUrls", function (data) {
      const urls = data.youtubeUrls || [];
      if (!urls.some((item) => item.url === url)) {
        urls.push({ url, title, thumbnail_url });
        chrome.storage.local.set({ youtubeUrls: urls }, loadUrls);
      } else {
        alert("This URL already exists in the list.");
      }
    });
  }

  function loadUrls() {
    chrome.storage.local.get("youtubeUrls", function (data) {
      const urls = data.youtubeUrls || [];
      urlList.innerHTML =
        urls.length === 0 ? "<p>There are no saved URLs.</p>" : "";
      urls.forEach((item, index) => {
        const urlItem = document.createElement("div");
        urlItem.className = "url-item";
        urlItem.draggable = true;
        urlItem.addEventListener("dragstart", (e) =>
          e.dataTransfer.setData("text/plain", index)
        );
        urlItem.addEventListener("dragover", (e) => e.preventDefault());
        urlItem.addEventListener("drop", (e) => handleDrop(e, index, urls));

        const urlTitle = document.createElement("div");
        urlTitle.className = "url-title";
        urlTitle.textContent = item.title;
        urlTitle.title = item.url;

        const playButton = createButton("images/play.png", "Play", () =>
          playUrl(item, index, urls)
        );
        const removeButton = createButton("images/delete.png", "Remove", () =>
          removeUrl(index, urls)
        );

        urlItem.appendChild(urlTitle);
        urlItem.appendChild(playButton);
        urlItem.appendChild(removeButton);
        urlList.appendChild(urlItem);
      });
    });
  }

  function handleDrop(e, targetIndex, urls) {
    e.preventDefault();
    const draggedIndex = e.dataTransfer.getData("text/plain");
    if (draggedIndex !== targetIndex) {
      const draggedItem = urls.splice(draggedIndex, 1)[0];
      urls.splice(targetIndex, 0, draggedItem);
      chrome.storage.local.set({ youtubeUrls: urls }, loadUrls);
    }
  }

  function createButton(iconSrc, altText, onClick) {
    const button = document.createElement("button");
    const icon = document.createElement("img");
    icon.src = iconSrc;
    icon.alt = altText;
    icon.title = altText;
    icon.width = 14;
    icon.height = 14;
    button.appendChild(icon);
    button.addEventListener("click", onClick);
    return button;
  }

  function playUrl(item, index, urls) {
    chrome.tabs.create({ url: item.url });
    chrome.storage.local.set({ currentPlayIndex: index });
    addPlayedUrl(item.url, item.title);
    urls.splice(index, 1);
    chrome.storage.local.set({ youtubeUrls: urls }, loadUrls);
  }

  function removeUrl(index, urls) {
    urls.splice(index, 1);
    chrome.storage.local.set({ youtubeUrls: urls }, loadUrls);
  }

  function loadPlayedUrls() {
    chrome.storage.local.get("playedUrls", function (data) {
      const playedUrls = data.playedUrls || [];
      playedUrlList.innerHTML =
        playedUrls.length === 0 ? "<p>There are no played URLs.</p>" : "";
      playedUrls.forEach((item) => {
        const urlItem = document.createElement("div");
        urlItem.className = "url-item";
        const urlLink = document.createElement("a");
        urlLink.href = item.url;
        urlLink.textContent = item.title;
        urlLink.target = "_blank";
        urlItem.appendChild(urlLink);
        playedUrlList.appendChild(urlItem);
      });
    });
  }

  function addPlayedUrl(url, title) {
    chrome.storage.local.get("playedUrls", function (data) {
      let playedUrls = data.playedUrls || [];
      if (!playedUrls.some((item) => item.url === url)) {
        playedUrls.push({ url, title });
        if (playedUrls.length > 100) {
          playedUrls.shift();
        }
        chrome.storage.local.set({ playedUrls: playedUrls }, loadPlayedUrls);
      }
    });
  }
});
