/** Resize an uploaded or pasted image File/Blob into a compact JPEG data URL for IndexedDB storage. */
export async function compressImageFileToDataUrl(
  file: Blob,
  maxDim = 480,
  quality = 0.82
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์รูปภาพได้"));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Extract an image File/Blob from a React/DOM ClipboardEvent if present. */
export function extractImageFromClipboard(
  clipboardData: DataTransfer | null
): File | null {
  if (!clipboardData?.items) return null;
  for (const item of Array.from(clipboardData.items)) {
    if (item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

/** Generate an illustrated flashcard image via /api/image and compress it for IndexedDB. */
export async function requestGeneratedVocabImage(params: {
  word: string;
  reading?: string;
  meaningTh?: string;
  meaningEn?: string;
  provider?: "offline" | "gemini" | "openai";
  apiKey?: string;
}): Promise<string> {
  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(35000),
    body: JSON.stringify(params),
  });
  const json = (await res.json()) as { imageDataUrl?: string; error?: string };
  if (!res.ok || !json.imageDataUrl) {
    throw new Error(json.error || "ไม่สามารถสร้างรูปภาพได้");
  }
  const blobRes = await fetch(json.imageDataUrl);
  const blob = await blobRes.blob();
  return compressImageFileToDataUrl(blob, 480, 0.84);
}
