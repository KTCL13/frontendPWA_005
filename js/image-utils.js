const MAX_PX = 600;
const MAX_B64_KB = 48;

export function compressImageToBase64(file, { maxPx = MAX_PX, maxKB = MAX_B64_KB } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height * maxPx) / width);
          width = maxPx;
        } else {
          width = Math.round((width * maxPx) / height);
          height = maxPx;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

      let quality = 0.6;
      let base64 = canvas.toDataURL("image/jpeg", quality);
      let kb = (base64.length * 0.75) / 1024;

      while (kb > maxKB && quality > 0.1) {
        quality -= 0.05;
        base64 = canvas.toDataURL("image/jpeg", quality);
        kb = (base64.length * 0.75) / 1024;
      }

      if (kb > maxKB) {
        reject(new Error("La imagen es demasiado grande incluso después de comprimir."));
        return;
      }

      resolve({ base64, kb, width, height, quality });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen."));
    };

    img.src = objectUrl;
  });
}

export function base64ToBlob(base64) {
  const [header, data] = base64.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
