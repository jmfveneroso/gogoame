import { Config } from "./config.js";

export const GameState = {
  gameOver: false,
  balls: [],
  ballCreationTimerId: 0,
  grabbedBall: null,
  lastMouseX: 0,
  lastMouseY: 0,
  ballsToRemoveThisFrame: [],
  ballsToAddNewThisFrame: [],
  isDrawingWind: false,
  windCurve: null, // Will hold { points: [], createdAt: 0 }
  animationFrameId: 0,
  totalElapsedTime: 0,
  isPaused: false,
  nextSymbolIndex: 0,
  selectedBall: null,
  combinationQueue: [],
};
