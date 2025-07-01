import { GameState } from "./game_state.js";
import { Ball } from "./ball.js";
import { canvasWidth, canvasHeight, ctx } from "./ui.js";
import { Config } from "./config.js";

export function drawWindCurve(cfg) {
  if (!GameState.windCurve || GameState.windCurve.points.length < 2) return;

  const now = Date.now();
  const age = now - GameState.windCurve.createdAt;

  // Use the new dynamic lifetime property. Provide a fallback just in case.
  const currentLifetime = GameState.windCurve.lifetime;
  if (age > currentLifetime) {
    GameState.windCurve = null;
    return;
  }

  if (cfg.drawWindCurve) {
    const points = GameState.windCurve.points;
    // Also use the dynamic lifetime for the opacity calculation
    const fillColor = cfg.windFillColor.normal;

    // 1. Calculate edge points (this logic remains the same)
    const topEdgePoints = [];
    const bottomEdgePoints = [];
    for (let i = 0; i < points.length; i++) {
      const progress = i / (points.length - 1);
      const currentWidth =
        cfg.windMaxWidth - (cfg.windMaxWidth - cfg.windMinWidth) * progress;
      let tangentX, tangentY;
      if (i > 0 && i < points.length - 1) {
        tangentX = points[i + 1].x - points[i - 1].x;
        tangentY = points[i + 1].y - points[i - 1].y;
      } else if (i === 0) {
        tangentX = points[i + 1].x - points[i].x;
        tangentY = points[i + 1].y - points[i].y;
      } else {
        tangentX = points[i].x - points[i - 1].x;
        tangentY = points[i].y - points[i - 1].y;
      }
      const mag = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
      if (mag > 0) {
        tangentX /= mag;
        tangentY /= mag;
      }
      const normalX = -tangentY;
      const normalY = tangentX;
      topEdgePoints.push({
        x: points[i].x + (normalX * currentWidth) / 2,
        y: points[i].y + (normalY * currentWidth) / 2,
      });
      bottomEdgePoints.push({
        x: points[i].x - (normalX * currentWidth) / 2,
        y: points[i].y - (normalY * currentWidth) / 2,
      });
    }

    // 2. Draw the shape using curves for a smooth appearance
    ctx.beginPath();
    ctx.moveTo(topEdgePoints[0].x, topEdgePoints[0].y);

    // Draw the top edge with smooth quadratic curves
    for (let i = 1; i < topEdgePoints.length - 2; i++) {
      const xc = (topEdgePoints[i].x + topEdgePoints[i + 1].x) / 2;
      const yc = (topEdgePoints[i].y + topEdgePoints[i + 1].y) / 2;
      ctx.quadraticCurveTo(topEdgePoints[i].x, topEdgePoints[i].y, xc, yc);
    }

    // Draw the end cap and connect to the bottom edge, going backwards
    ctx.lineTo(
      bottomEdgePoints[bottomEdgePoints.length - 1].x,
      bottomEdgePoints[bottomEdgePoints.length - 1].y
    );

    // Draw the bottom edge with smooth quadratic curves
    for (let i = bottomEdgePoints.length - 2; i > 1; i--) {
      const xc = (bottomEdgePoints[i].x + bottomEdgePoints[i - 1].x) / 2;
      const yc = (bottomEdgePoints[i].y + bottomEdgePoints[i - 1].y) / 2;
      ctx.quadraticCurveTo(
        bottomEdgePoints[i].x,
        bottomEdgePoints[i].y,
        xc,
        yc
      );
    }

    ctx.closePath();

    // 3. Apply the "smoky" glow effect and fill the shape
    ctx.shadowColor = fillColor;
    ctx.shadowBlur = cfg.windShadowBlur;
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Reset shadow properties to avoid affecting other drawings
    ctx.shadowBlur = 0;
  }
}
