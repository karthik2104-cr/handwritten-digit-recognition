export function canvasHasInk(pixels: Uint8ClampedArray, threshold = 12): boolean {
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    if (red > threshold || green > threshold || blue > threshold) return true;
  }
  return false;
}

export function pointerToCanvas(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.width;
  const height = rect.height || canvas.height;
  return {
    x: ((clientX - rect.left) / width) * canvas.width,
    y: ((clientY - rect.top) / height) * canvas.height,
  };
}
