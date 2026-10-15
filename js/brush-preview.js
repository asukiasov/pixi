export function drawBrushPreview(canvas, brush) {
  canvas.width = brush.width;
  canvas.height = brush.height;
  const ctx = canvas.getContext('2d');
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, brush.width, brush.height);
  ctx.fillStyle = '#000000';
  for (const [x, y, alpha = 1] of brush.pixels) {
    ctx.globalAlpha = alpha;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
  return canvas;
}
