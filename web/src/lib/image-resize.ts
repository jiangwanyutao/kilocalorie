/**
 * 客户端 resize 图片 · 长边不超过 maxDim · 输出 JPEG blob
 * 避免上传 3-5MB 手机原图到 API，头像通常压到 <100KB
 */
export async function resizeImage(
  file: File,
  maxDim: number = 512,
  quality: number = 0.85,
): Promise<Blob> {
  const bitmap = await fileToBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 不可用');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('图片编码失败'))),
      'image/jpeg',
      quality,
    );
  });
}

async function fileToBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => undefined,
    } as unknown as ImageBitmap;
  } finally {
    URL.revokeObjectURL(url);
  }
}
