import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { Ball } from "./ball.js";
import { canvasWidth, canvasHeight } from "./ui.js";

export function destroyBall(ballToDestroy, type) {
  // Prevent a ball from being destroyed multiple times in one frame
  if (GameState.ballsToRemoveThisFrame.includes(ballToDestroy)) return;

  // 1. Queue the ball for removal
  GameState.ballsToRemoveThisFrame.push(ballToDestroy);
}
