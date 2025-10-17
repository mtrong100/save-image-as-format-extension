const formats = ["jpg", "jpeg", "png"];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-as",
    title: "Save image as...",
    contexts: ["image"],
  });

  formats.forEach((format) => {
    chrome.contextMenus.create({
      id: `save-as-${format}`,
      parentId: "save-as",
      title: format.toUpperCase(),
      contexts: ["image"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const format = info.menuItemId.split("-").pop();
  const imageUrl = info.srcUrl;

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64data = reader.result;

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: drawAndSaveImage,
        args: [base64data, format],
      });
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error("Error loading image: ", error);
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () =>
        alert(
          "Unable to load image. Possibly blocked by CORS or network error."
        ),
    });
  }
});

// Hàm inject vào tab hiện tại
function drawAndSaveImage(dataUrl, format) {
  const img = new Image();
  img.src = dataUrl;

  img.onload = function () {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    canvas.toBlob(
      (blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = "converted-image." + format;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      },
      "image/" + (format === "jpg" ? "jpeg" : format),
      0.95
    );
  };

  img.onerror = function () {
    alert("This image could not be processed.");
  };
}
