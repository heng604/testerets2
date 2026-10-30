// Shrinks photos in the browser before upload. Vercel rejects request bodies
// larger than 4.5 MB, and raw phone photos are often 5-10 MB each.
export function compressImage(file, maxSize = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.onload = () => {
      if (file.type === 'image/gif' || file.type === 'image/svg+xml') return resolve(reader.result);
      const img = new Image();
      img.onerror = () => resolve(reader.result); // fall back to the original
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
