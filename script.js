import { Config } from "./config.js";
import { loadSymbols } from "./symbols.js";
import { Ball } from "./ball.js";
import { processCollisions } from "./physics.js";
import {
  addUiEvents,
  clearCanvas,
  ctx,
  canvasWidth,
  canvasHeight,
  canvas,
} from "./ui.js";
import { GameState } from "./game_state.js";
import { addPlayerEvents, addPlayerWindEvents } from "./player.js";
import { addBallSpawnsEvents, resetBallCreationTimer } from "./environment.js";
import { drawWindCurve } from "./wind.js";
import { combineSymbols } from "./physics.js";

let backgroundPattern = null;

let lastFrameTime = performance.now();
function updateBalls() {
  for (let i = GameState.balls.length - 1; i >= 0; i--) {
    const ball = GameState.balls[i];
    if (!ball.update(Config)) {
      GameState.balls.splice(i, 1);
    }
  }
}

// --- Create the Pause Text Element ---
const pauseTextElement = document.createElement("div");
pauseTextElement.id = "pause-text";
pauseTextElement.textContent = "PAUSED";
pauseTextElement.classList.add("hidden");
document.getElementById("game-container").appendChild(pauseTextElement);

function processCombinationQueue() {
  if (GameState.combinationQueue.length > 0) {
    for (const [ballA, ballB] of GameState.combinationQueue) {
      // Attempt to combine the pair. combineSymbols will handle
      // adding them to the removal/addition arrays for this frame.
      combineSymbols(ballA, ballB);
    }
    // Clear the queue after processing
    GameState.combinationQueue = [];
  }
}

// --- Create the Toggle Pause Function ---
function togglePause() {
  GameState.isPaused = !GameState.isPaused;
  const pauseBtn = document.getElementById("pause-btn");

  if (GameState.isPaused) {
    // Show the pause text and change button label
    pauseTextElement.classList.remove("hidden");
    pauseBtn.innerHTML = "&#x25B6;";
    // Stop the ball spawner
    clearInterval(GameState.ballCreationTimerId);
  } else {
    // Hide the pause text and change button label back
    pauseTextElement.classList.add("hidden");
    pauseBtn.innerHTML = "&#x23F8;";
    // Restart the ball spawner and game loop correctly
    lastFrameTime = performance.now(); // Prevents a deltaTime jump
    resetBallCreationTimer(); // Restart ball spawner
    requestAnimationFrame(gameLoop); // Re-engage the loop
  }
}

function updateDangerHighlights(cfg) {
  // First, reset the dangerous flag on all balls from the previous frame
  for (const ball of GameState.balls) {
    ball.isDangerous = false;
  }

  // If the feature is disabled in the config, do nothing further.
  if (!cfg.enableDangerHighlight) return;

  // --- NEW: Create a Map for fast lookups ---
  // The map will store symbol IDs as keys and an array of balls as values.
  // e.g., { 'S2_SOLID_BOTH': [ball1, ball2], 'S3_LINES_BOTH': [ball3] }
  const symbolIdToBallsMap = new Map();
  for (const ball of GameState.balls) {
    if (!symbolIdToBallsMap.has(ball.symbolId)) {
      symbolIdToBallsMap.set(ball.symbolId, []);
    }
    symbolIdToBallsMap.get(ball.symbolId).push(ball);
  }

  // Iterate through every possible pair of balls
  for (let i = 0; i < GameState.balls.length; i++) {
    for (let j = i + 1; j < GameState.balls.length; j++) {
      const ballA = GameState.balls[i];
      const ballB = GameState.balls[j];

      // Skip check if either ball is below the minimum level threshold
      if (
        ballA.level < cfg.dangerHighlightMinLevel ||
        ballB.level < cfg.dangerHighlightMinLevel
      ) {
        continue;
      }

      // Condition 1: Are the two ingredient balls close to each other?
      const pairDistance = Math.sqrt(
        (ballA.x - ballB.x) ** 2 + (ballA.y - ballB.y) ** 2
      );
      if (pairDistance >= cfg.dangerHighlightMaxDistance) {
        continue;
      }

      // Condition 2: Do they form a valid new symbol?
      const resultId = getCombinedSymbolId(ballA.symbolId, ballB.symbolId);
      if (!resultId) {
        continue;
      }

      // Condition 3: Does that new symbol type already exist on screen?
      if (symbolIdToBallsMap.has(resultId)) {
        const existingResultBalls = symbolIdToBallsMap.get(resultId);

        let finalResultBall = null;
        // Is one of our ingredient balls (A or B) close to any of the existing result balls?
        const isCloseToResult = existingResultBalls.some((resultBall) => {
          const distToA = Math.sqrt(
            (ballA.x - resultBall.x) ** 2 + (ballA.y - resultBall.y) ** 2
          );
          const distToB = Math.sqrt(
            (ballB.x - resultBall.x) ** 2 + (ballB.y - resultBall.y) ** 2
          );

          const isCloseToResult =
            distToA < cfg.dangerHighlightMaxDistance ||
            distToB < cfg.dangerHighlightMaxDistance;

          if (isCloseToResult) {
            finalResultBall = resultBall;
          }

          return isCloseToResult;
        });

        if (isCloseToResult) {
          // If all conditions are met, mark the pair as dangerous.
          ballA.isDangerous = true;
          ballB.isDangerous = true;
          finalResultBall.isDangerous = true;
        }
      }
    }
  }
}

function drawBalls(cfg) {
  for (const ball of GameState.balls) {
    ball.draw(cfg);
  }
}

function updateCorruptionPool(cfg) {
  // Smoothly ease the visible level towards the target level
  if (GameState.corruptionLevel !== GameState.corruptionTargetLevel) {
    const difference =
      GameState.corruptionTargetLevel - GameState.corruptionLevel;
    GameState.corruptionLevel += difference * cfg.poolRiseSpeed;
  }

  // Calculate the base height of the pool's surface
  const baseHeight =
    (GameState.corruptionLevel / cfg.maxCorruptionLevel) *
    (canvasHeight * cfg.poolMaxHeight);

  // --- Animation and State Update ---
  if (GameState.isPoolRising) {
    const elapsed = Date.now() - GameState.lifeLossAnimationStart;
    const animationDuration = 2000;
    const progress = Math.min(1.0, elapsed / animationDuration);

    const currentPoolHeight =
      baseHeight + (canvasHeight - baseHeight) * progress;
    GameState.corruptionPoolY = canvasHeight - currentPoolHeight;

    if (progress >= 1.0 && !GameState.gameOver) {
      triggerGameOver();
    }
  } else {
    GameState.corruptionPoolY = canvasHeight - baseHeight;
  }
}

function updatePoolShine(cfg) {
  if (GameState.poolShineIntensity > 0) {
    GameState.poolShineIntensity -= cfg.poolShineFadeSpeed;
  }
}

function draw(cfg, deltaTime) {
  // --- Screen Shake Logic ---
  let shakeX = 0;
  let shakeY = 0;

  // Check if the life loss animation is currently active
  if (GameState.isLosingLife && Config.enableLifeLossAnimation) {
    const elapsed = Date.now() - GameState.lifeLossAnimationStart;
    const progress = elapsed / cfg.lifeLossAnimationDuration;

    if (progress < 1) {
      // As the animation progresses, the shake gets weaker
      const currentMagnitude = cfg.screenShakeMagnitude * (1 - progress);
      shakeX = (Math.random() - 0.5) * currentMagnitude;
      shakeY = (Math.random() - 0.5) * currentMagnitude;
    }
  }

  canvas.style.backgroundColor = cfg.invertColors
    ? cfg.backgroundColor.inverted
    : cfg.backgroundColor.normal;

  // Save the context state and apply the shake translation
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Set the solid background color first
  ctx.fillStyle = cfg.invertColors
    ? cfg.backgroundColor.inverted
    : cfg.backgroundColor.normal;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Then, draw the repeating pattern on top
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  drawBalls(cfg);
  drawWindCurve(cfg);

  ctx.restore();
}

function gameLoop(currentTime) {
  if (GameState.isPaused) {
    return;
  }

  const deltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;

  GameState.totalElapsedTime += deltaTime;

  if (GameState.gameOver) {
    draw(Config, deltaTime);
    return;
  }

  GameState.ballsToRemoveThisFrame = [];
  GameState.ballsToAddNewThisFrame = [];

  updateBalls();

  processCombinationQueue();
  processCollisions();

  draw(Config, deltaTime);

  GameState.animationFrameId = requestAnimationFrame(gameLoop);
}

async function main() {
  // Wait for the symbols to load before doing anything else
  await loadSymbols();

  addPlayerWindEvents();
  addBallSpawnsEvents();
  addUiEvents();

  document.getElementById("pause-btn").addEventListener("click", togglePause);

  // Start the game loop
  GameState.animationFrameId = requestAnimationFrame(gameLoop);
}

main();
