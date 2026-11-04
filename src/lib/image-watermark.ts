// Burn the mark into the uploaded property photo, so it is retained by cards,
// galleries, sponsored properties and downloaded files alike.
export async function watermarkPropertyPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size >= 5 * 1024 * 1024) {
    throw new Error('Choose a property photo smaller than 5 MB.');
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error(`Could not read ${file.name}. Use a JPG, PNG or WebP photo.`); }
  try {
    const canvas = document.createElement('canvas');
    // Preserve the 2:1 projection of tour panoramas; ordinary photos need no
    // more than 4096px to retain detail without excessively large downloads.
    const maxEdge = bitmap.width / bitmap.height >= 1.9 ? 8192 : 4096;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing is unavailable. Please try another browser.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // One large, quiet central mark. The fine dark stroke keeps it visible on
    // pale walls while the translucent lettering lets the photograph lead.
    context.font = `600 ${canvas.width * 0.105}px Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = Math.max(0.5, canvas.width / 1400);
    context.strokeStyle = 'rgba(15, 23, 42, 0.12)';
    context.fillStyle = 'rgba(255, 255, 255, 0.19)';
    const maxWidth = canvas.width * 0.65;
    context.strokeText('MeroKotha', canvas.width / 2, canvas.height / 2, maxWidth);
    context.fillText('MeroKotha', canvas.width / 2, canvas.height / 2, maxWidth);
    const encode = (quality: number) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare this photo. Please try again.')), 'image/webp', quality);
    });
    let blob = await encode(0.9);
    if (blob.size >= 5 * 1024 * 1024) blob = await encode(0.72);
    if (blob.size >= 5 * 1024 * 1024) throw new Error(`${file.name} is too large after processing. Choose a smaller image.`);
    const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, { type: blob.type, lastModified: file.lastModified });
  } finally { bitmap.close(); }
}
