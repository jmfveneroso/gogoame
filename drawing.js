/**
 * drawing.js - Contains the simplified drawing function for symbols.
 */

/**
 * Draws a text-based symbol inside a ball.
 */
export function drawSymbol(ctx, symbolChar, x, y, radius, color) {
  const fontSize = radius * 1.5; // Scale font size with the ball's radius
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(symbolChar, x, y);
}
