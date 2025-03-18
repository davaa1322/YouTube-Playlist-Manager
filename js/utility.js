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
