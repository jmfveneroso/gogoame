import { Config } from "./config.js";
import { canvas } from "./ui.js";
import { GameState } from "./game_state.js";

let hasInteracted = false;

// --- Generic Input Handlers ---
// These functions contain the core logic and are called by both mouse and touch events.

/**
 * Handles clicks or touches on the canvas to select and combine balls.
 */
function handleCanvasClick(x, y) {
  if (GameState.gameOver || GameState.isPaused) return;

  let clickedBall = null;
  for (let i = GameState.balls.length - 1; i >= 0; i--) {
    const ball = GameState.balls[i];
    const distance = Math.sqrt((x - ball.x) ** 2 + (y - ball.y) ** 2);
    if (distance < ball.radius) {
      clickedBall = ball;
      break;
    }
  }

  if (clickedBall) {
    if (GameState.selectedBall) {
      // A ball is already selected. Queue the combination.
      if (GameState.selectedBall.id !== clickedBall.id) {
        // Add the pair of balls to the queue for processing in the main loop.
        GameState.combinationQueue.push([GameState.selectedBall, clickedBall]);
      }
      // Deselect the first ball.
      GameState.selectedBall.isSelected = false;
      GameState.selectedBall = null;
    } else {
      // This is the first click, select the ball.
      GameState.selectedBall = clickedBall;
      clickedBall.isSelected = true;
    }
  } else {
    // Click was on empty space, so deselect.
    if (GameState.selectedBall) {
      GameState.selectedBall.isSelected = false;
      GameState.selectedBall = null;
    }
  }
}

/**
 * Starts the wind curve drawing process at a specific coordinate.
 * @param {number} x The starting x-coordinate.
 * @param {number} y The starting y-coordinate.
 */
function handleDragStart(x, y) {
  if (GameState.gameOver) return;

  if (Config.enableSlingshot) {
    // Iterate backwards to prioritize grabbing topmost balls
    for (let i = GameState.balls.length - 1; i >= 0; i--) {
      const ball = GameState.balls[i];
      const distance = Math.sqrt((x - ball.x) ** 2 + (y - ball.y) ** 2);
      if (distance < ball.radius) {
        GameState.grabbedBall = ball;
        ball.isGrabbed = true;
        ball.vx = 0;
        ball.vy = 0;
        break;
      }
    }

    return;
  }

  GameState.isDrawingWind = true;

  // Initialize a new wind curve
  GameState.windCurve = {
    points: [{ x, y }],
    createdAt: Date.now(),
  };

  for (const ball of GameState.balls) {
    ball.isCapturedByWind = false;
    ball.isCapturedByWindTimer = null;
  }
}

function _snapAngle(points, newPoint) {
  const lookback = Math.floor(Config.windAngleLookback);
  if (Config.enableAngleSnapping && points.length > lookback) {
    // The first point of our vector is now several points back in the array
    const p1 = points[points.length - lookback];
    const p2 = points[points.length - 1]; // The last point
    const p3 = newPoint; // The new potential point

    // The rest of the angle calculation remains the same
    const v1x = p2.x - p1.x;
    const v1y = p2.y - p1.y;
    const v2x = p3.x - p2.x;
    const v2y = p3.y - p2.y;

    const dotProduct = v1x * v2x + v1y * v2y;
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (mag1 > 0 && mag2 > 0) {
      const angle = Math.acos(dotProduct / (mag1 * mag2)) * (180 / Math.PI);

      if (angle > Config.maxWindCurveAngle) {
        handleDragEnd(); // Finalize the old curve
        handleDragStart(newPoint.x, newPoint.y); // Immediately start a new one
        return true; // Stop processing this move
      }
    }
  }
  return false;
}

function _smoothCurve(points) {
  if (points.length < 3) return; // Need at least 3 points to smooth

  // 2. Iterate backwards over the existing points (excluding the two newest ones).
  // This loop pulls each point slightly towards the average of its neighbors.
  for (let i = points.length - 3; i > 0; i--) {
    const p0 = points[i - 1]; // Previous point
    const p1 = points[i]; // The point we are smoothing
    const p2 = points[i + 1]; // Next point

    // Find the average position between the neighbors
    const avgX = (p0.x + p2.x) / 2;
    const avgY = (p0.y + p2.y) / 2;

    // Move the current point a fraction of the way towards that average.
    p1.x += (avgX - p1.x) * Config.windSmoothingFactor;
    p1.y += (avgY - p1.y) * Config.windSmoothingFactor;
  }
}

function _calculateCurveLength() {
  const points = GameState.windCurve.points;
  // Calculate the total length of the curve by summing its segments
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    totalLength += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }

  GameState.windCurve.totalLength = totalLength;
}

/**
 * Continues the wind curve drawing process at a new coordinate.
 * @param {number} x The new x-coordinate.
 * @param {number} y The new y-coordinate.
 */
function handleDragMove(x, y) {
  if (GameState.grabbedBall) {
    // --- Slingshot Logic ---
    const ball = GameState.grabbedBall;
    const dx = Config.reverseSlingshot ? x - ball.x : ball.x - x;
    const dy = Config.reverseSlingshot ? y - ball.y : ball.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const cappedDist = Math.min(dist, Config.slingshotMaxStrength);
    const launchX = (dx / dist) * cappedDist;
    const launchY = (dy / dist) * cappedDist;

    ball.slingshotVector = { x: launchX, y: launchY };
    return;
  }

  if (!GameState.isDrawingWind || !GameState.windCurve) return;

  const points = GameState.windCurve.points;
  const lastPoint = points[points.length - 1];
  const distance = Math.sqrt((x - lastPoint.x) ** 2 + (y - lastPoint.y) ** 2);

  if (distance > Config.minPointDistance) {
    const newPoint = { x, y };
    // Ensure we have enough points to perform the lookback check

    if (_snapAngle(points, newPoint)) {
      return;
    }

    // 1. Add the new, raw point to the end of the curve. This ensures no lag.
    GameState.windCurve.points.push(newPoint);

    _smoothCurve(points);

    _calculateCurveLength();
  }
}

/**
 * Ends the wind curve drawing process.
 */
function handleDragEnd() {
  if (GameState.grabbedBall) {
    const ball = GameState.grabbedBall;
    // Apply the final velocity from the slingshot vector
    ball.vx = ball.slingshotVector.x * Config.slingshotPowerMultiplier;
    ball.vy = ball.slingshotVector.y * Config.slingshotPowerMultiplier;

    // Release the ball
    ball.isGrabbed = false;
    ball.slingshotVector = { x: 0, y: 0 };
    GameState.grabbedBall = null;
  }

  if (GameState.windCurve) {
    _calculateCurveLength();

    // Calculate the final lifetime based on the length
    const totalLength = GameState.windCurve.totalLength;
    const dynamicLifetime = totalLength * Config.windLifetimePerPixel;
    GameState.windCurve.lifetime = Config.windBaseLifetime + dynamicLifetime;
  }

  GameState.isDrawingWind = false;
}

export function addPlayerEvents() {}
// --- Main Exported Function ---

/**
 * Sets up all player input listeners for both mouse (desktop) and touch (mobile).
 */
export function addPlayerWindEvents() {
  // --- Mouse Event Listeners ---
  canvas.addEventListener("mousedown", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (Config.combineClick) {
      handleCanvasClick(x, y);
    } else {
      handleDragStart(x, y);
    }
  });

  document.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    handleDragMove(event.clientX - rect.left, event.clientY - rect.top);
  });

  document.addEventListener("mouseup", () => {
    handleDragEnd();
  }); // --- Touch Event Listeners ---

  canvas.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = event.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      // --- THIS IS THE FIX ---
      // This now correctly checks the game mode for touch input.
      if (Config.combineClick) {
        handleCanvasClick(x, y);
      } else {
        handleDragStart(x, y);
      }
      // --- END OF FIX ---
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = event.touches[0];
      handleDragMove(touch.clientX - rect.left, touch.clientY - rect.top);
    },
    { passive: false }
  );

  canvas.addEventListener("touchend", handleDragEnd);
  canvas.addEventListener("touchcancel", handleDragEnd);
}
