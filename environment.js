import { Config } from "./config.js";
import { symbolDefinitions, L1_SYMBOLS } from "./symbols.js";
import { Ball } from "./ball.js";
import { canvasWidth, canvasHeight, canvas, ctx } from "./ui.js";
import { GameState } from "./game_state.js";
import { addPlayerEvents } from "./player.js";

function createBall() {
  if (GameState.gameOver) return;

  let randomSymbolId;

  // 1. Roll the dice (get a random number between 0 and 1).
  const roll = Math.random();

  randomSymbolId = L1_SYMBOLS[GameState.nextSymbolIndex];
  GameState.nextSymbolIndex =
    (GameState.nextSymbolIndex + 1) % L1_SYMBOLS.length;

  const symbolDef = symbolDefinitions[randomSymbolId];

  let actualRadius;
  const sizeMultiplier =
    1.0 + (symbolDef.level - 1) * Config.sizeIncreasePerLevel;
  actualRadius = Config.baseBallRadius * sizeMultiplier;

  actualRadius = Math.max(5, actualRadius);

  const x = Math.random() * (canvasWidth - actualRadius * 2) + actualRadius;

  const y = -actualRadius - Math.random() * 20;
  const isBlack = Math.random() < Config.Initial_Ratio_Black_To_Gray;
  GameState.balls.push(new Ball(x, y, actualRadius, randomSymbolId, isBlack));
}

export function addBallSpawnsEvents() {
  if (Config.ballCreationInterval > 0) {
    GameState.ballCreationTimerId = setInterval(
      createBall,
      Config.ballCreationInterval
    );
  }
}

export function resetBallCreationTimer() {
  clearInterval(GameState.ballCreationTimerId);
  if (Config.ballCreationInterval > 0) {
    GameState.ballCreationTimerId = setInterval(
      createBall,
      Config.ballCreationInterval
    );
  }
}
