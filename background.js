// background.js
const SUPPORTED_FORMATS = ["jpg", "jpeg", "png"];
const MENU_ID_PREFIX = "save-as-";

chrome.runtime.onInstalled.addListener(() => {
  // Create parent menu item
  chrome.contextMenus.create({
    id: MENU_ID_PREFIX + "parent",
    title: "Save image as...",
    contexts: ["image"],
  });

  // Create format-specific menu items
  SUPPORTED_FORMATS.forEach((format) => {
    chrome.contextMenus.create({
      id: MENU_ID_PREFIX + format,
      parentId: MENU_ID_PREFIX + "parent",
      title: format.toUpperCase(),
      contexts: ["image"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (
    !info.menuItemId.startsWith(MENU_ID_PREFIX) ||
    info.menuItemId === MENU_ID_PREFIX + "parent"
  ) {
    return;
  }

  const format = info.menuItemId.replace(MENU_ID_PREFIX, "");
  const imageUrl = info.srcUrl;

  if (!SUPPORTED_FORMATS.includes(format) || !imageUrl) {
    console.error("Invalid format or image URL");
    return;
  }

  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    const reader = new FileReader();

    reader.onload = () => {
      const base64data = reader.result;

      // Inject and execute the save function in the current tab
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: drawAndSaveImage,
          args: [base64data, format],
        })
        .catch((err) => {
          console.error("Failed to execute script:", err);
          showError(tab.id, "Failed to process image. Please try again.");
        });
    };

    reader.onerror = () => {
      throw new Error("Failed to read image data");
    };

    reader.readAsDataURL(blob);
  } catch (error) {
    console.error("Error processing image:", error);
    showError(
      tab.id,
      error.message.includes("CORS") ||
        error.message.includes("Failed to fetch")
        ? "Unable to load image due to CORS restrictions or network error."
        : "Failed to process the image. Please try another image.",
    );
  }
});

function showError(tabId, message) {
  chrome.scripting
    .executeScript({
      target: { tabId },
      func: (msg) => alert("Save Image As Format Error: " + msg),
      args: [message],
    })
    .catch((err) => console.error("Failed to show error:", err));
}

// Function injected into the current tab
function drawAndSaveImage(dataUrl, format) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = dataUrl;

    img.onload = function () {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext("2d");

        // Fill with white background for JPG format (to avoid black background for transparent PNGs)
        if (format === "jpg" || format === "jpeg") {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        // Determine MIME type
        const mimeType = format === "jpg" ? "image/jpeg" : `image/${format}`;

        // Set quality (higher for PNG, compressed for JPG)
        const quality = format === "png" ? 1.0 : 0.92;

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to create image blob"));
              return;
            }

            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;

            // Generate filename with timestamp
            const timestamp = new Date()
              .toISOString()
              .slice(0, 19)
              .replace(/[:T]/g, "-");
            a.download = `image-${timestamp}.${format}`;

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            resolve();
          },
          mimeType,
          quality,
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = function () {
      reject(new Error("Failed to load image for processing"));
    };
  });
}
