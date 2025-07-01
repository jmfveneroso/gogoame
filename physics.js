import { GameState } from "./game_state.js";
import { Ball } from "./ball.js";
import { symbolDefinitions, L1_SYMBOLS } from "./symbols.js";
import { Config } from "./config.js";
import { destroyBall } from "./mechanics.js";
import { canvasWidth, canvasHeight } from "./ui.js";

/**
 * Correctly extracts the level number from a symbol ID.
 * @param {string} inputString - The symbol ID (e.g., 'S10_SOLID_BOTH').
 * @returns {number | null} The level number or null if not found.
 */
function getLevel(inputString) {
  console.log(inputString);
  const underscoreIndex = inputString.indexOf("_");
  if (underscoreIndex > 1) {
    // Get the substring between 'S' and the '_' (e.g., '10')
    const levelStr = inputString.substring(1, underscoreIndex);
    return parseInt(levelStr, 10);
  }
  return null;
}

/**
 * Correctly extracts the type name from a symbol ID.
 * @param {string} inputString - The symbol ID (e.g., 'S10_SOLID_BOTH').
 * @returns {string | null} The type name including the underscore (e.g., '_SOLID_BOTH').
 */
function getLineType(inputString) {
  const underscoreIndex = inputString.indexOf("_");
  if (underscoreIndex !== -1) {
    // Return the substring from the '_' to the end.
    return inputString.substring(underscoreIndex);
  }
  return null;
}

// In physics.js, replace the getCombinedSymbolId function
function getCombinedSymbolId(id1, id2) {
  for (const id in symbolDefinitions) {
    const def = symbolDefinitions[id];
    if (def.sources && def.sources.length === 2) {
      // Check for the recipe in both orders
      if (
        (def.sources[0] === id1 && def.sources[1] === id2) ||
        (def.sources[1] === id1 && def.sources[0] === id2)
      ) {
        return parseInt(id); // Return the numeric ID of the new symbol
      }
    }
  }
  return null;
}

function createBall(ballA, ballB, combinedSymId) {
  const productDef = symbolDefinitions[combinedSymId];

  const sizeMultiplier =
    1.0 + (productDef.level - 1) * Config.sizeIncreasePerLevel;
  let newRadius = Config.baseBallRadius * sizeMultiplier;
  newRadius = Math.max(5, newRadius); // Use 5 to match environment.js

  const midX =
    (ballA.x * ballB.radius + ballB.x * ballA.radius) /
    (ballA.radius + ballB.radius);
  const midY =
    (ballA.y * ballB.radius + ballB.y * ballA.radius) /
    (ballA.radius + ballB.radius);
  const x = Config.combineInMiddle ? midX : ballB.x;
  const y = Config.combineInMiddle ? midY : ballB.y;

  const totalMassProxy = ballA.radius + ballB.radius;
  const newVx =
    (ballA.vx * ballA.radius + ballB.vx * ballB.radius) / totalMassProxy;
  const newVy =
    (ballA.vy * ballA.radius + ballB.vy * ballB.radius) / totalMassProxy;

  const newBall = new Ball(x, y, newRadius, combinedSymId, false);
  newBall.vx = newVx;
  newBall.vy = newVy;
  newBall.gravityImmuneUntil =
    Date.now() +
    Config.windGravityImmunityDuration +
    Config.levitationLevelMultiplier * productDef.level;

  return newBall;
}

export function combineSymbols(ballA, ballB) {
  let combinedSymId = getCombinedSymbolId(ballA.symbolId, ballB.symbolId);
  if (!combinedSymId) {
    return false;
  }

  const newBall = createBall(ballA, ballB, combinedSymId);

  GameState.ballsToRemoveThisFrame.push(ballA, ballB);
  GameState.ballsToAddNewThisFrame.push(newBall);
}

export function bounce(ballA, ballB) {
  const dx = ballA.x - ballB.x;
  const dy = ballA.y - ballB.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // 1. Resolve Overlap
  // This pushes the balls apart slightly so they don't get stuck inside each other.
  const overlap = ballA.radius + ballB.radius - distance;
  if (overlap > 0) {
    const totalMass = ballA.radius + ballB.radius;

    // The amount each ball is pushed is inversely proportional to its mass
    const pushFactor = overlap / totalMass;

    ballA.x += (dx / distance) * ballB.radius * pushFactor;
    ballA.y += (dy / distance) * ballB.radius * pushFactor;
    ballB.x -= (dx / distance) * ballA.radius * pushFactor;
    ballB.y -= (dy / distance) * ballA.radius * pushFactor;
  }

  // 2. Calculate Bounce Physics (2D Elastic Collision)

  // Find the normal and tangent vectors of the collision plane
  const normalX = dx / distance;
  const normalY = dy / distance;
  const tangentX = -normalY;
  const tangentY = normalX;

  // Project the velocities of each ball onto the normal and tangent vectors
  const v1n = ballA.vx * normalX + ballA.vy * normalY; // ballA's velocity along the normal
  const v1t = ballA.vx * tangentX + ballA.vy * tangentY; // ballA's velocity along the tangent
  const v2n = ballB.vx * normalX + ballB.vy * normalY;
  const v2t = ballB.vx * tangentX + ballB.vy * tangentY;

  // Use radius as a proxy for mass
  const m1 = ballA.radius;
  const m2 = ballB.radius;

  // Perform a 1D elastic collision calculation on the normal velocities
  const v1n_final = (v1n * (m1 - m2) + 2 * m2 * v2n) / (m1 + m2);
  const v2n_final = (v2n * (m2 - m1) + 2 * m1 * v1n) / (m1 + m2);

  // The tangential velocities remain unchanged after the collision
  // Convert the final scalar velocities back into vectors
  const v1nVecX = v1n_final * normalX;
  const v1nVecY = v1n_final * normalY;
  const v1tVecX = v1t * tangentX;
  const v1tVecY = v1t * tangentY;

  const v2nVecX = v2n_final * normalX;
  const v2nVecY = v2n_final * normalY;
  const v2tVecX = v2t * tangentX;
  const v2tVecY = v2t * tangentY;

  // Recombine the normal and tangent vectors to get the final velocity
  ballA.vx = v1nVecX + v1tVecX;
  ballA.vy = v1nVecY + v1tVecY;
  ballB.vx = v2nVecX + v2tVecX;
  ballB.vy = v2nVecY + v2tVecY;
}

function knockbackOnCollision(voidBall, targetBall, newBall) {
  let knockbackVx = 0;
  let knockbackVy = 0;

  // Calculate the vector pointing from the void ball to the target ball.
  const dx = targetBall.x - voidBall.x;
  const dy = targetBall.y - voidBall.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Normalize the vector (make its length 1) to get a pure direction.
  // We check if distance > 0 to avoid dividing by zero.
  if (distance > 0) {
    const normalizedX = dx / distance;
    const normalizedY = dy / distance;

    // Apply the knockback force from the config.
    knockbackVx = normalizedX * Config.degradationKnockback * 5;
    knockbackVy = normalizedY * Config.degradationKnockback * 5;
  } else {
    // Fallback: If they are perfectly overlapped, push the new ball upwards.
    knockbackVy = -Config.degradationKnockback;
  }

  // Inherit the parent's velocity AND add the new knockback force.
  newBall.vx += targetBall.vx + knockbackVx;
  newBall.vy += targetBall.vy + knockbackVy;
}

export function isColliding(ballA, ballB) {
  if (
    GameState.ballsToRemoveThisFrame.includes(ballB) ||
    GameState.ballsToRemoveThisFrame.includes(ballA) ||
    ballA.isGrabbed ||
    ballB.isGrabbed
  ) {
    return false;
  }

  const dx = ballA.x - ballB.x;
  const dy = ballA.y - ballB.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance < ballA.radius + ballB.radius && distance > 0.1;
}

function shouldDestroy(ballA, ballB) {
  let destroy =
    ballA.symbolId === ballB.symbolId &&
    !Config.enableWildcard &&
    !Config.enableSimpleCombinationMode &&
    !Config.enableWindCombination;

  if (
    Config.enableWildcard &&
    def1.isWildcard &&
    def2.isWildcard &&
    level1 == level2
  ) {
    destroy = true;
  }
  return destroy;
}

function destroySymbols(ballA, ballB) {
  let destroy = shouldDestroy(ballA, ballB);
  if (!destroy) {
    return false;
  }

  const midX =
    (ballA.x * ballB.radius + ballB.x * ballA.radius) /
    (ballA.radius + ballB.radius);
  const midY =
    (ballA.y * ballB.radius + ballB.y * ballA.radius) /
    (ballA.radius + ballB.radius);

  destroyBall(ballA);
  destroyBall(ballB);
  return true;
}

export function processCollision(ballA, ballB) {
  if (destroySymbols(ballA, ballB)) {
    return;
  }

  if (combineSymbols(ballA, ballB)) {
    return;
  }

  bounce(ballA, ballB);
}

export function processCollisions() {
  for (let i = 0; i < GameState.balls.length; i++) {
    let ballA = GameState.balls[i];
    if (GameState.ballsToRemoveThisFrame.includes(ballA)) continue;

    for (let j = i + 1; j < GameState.balls.length; j++) {
      let ballB = GameState.balls[j];

      if (!isColliding(ballA, ballB)) continue;

      processCollision(ballA, ballB);
    }
  }

  if (GameState.ballsToRemoveThisFrame.length > 0) {
    GameState.balls = GameState.balls.filter(
      (b) => !GameState.ballsToRemoveThisFrame.includes(b)
    );
  }

  if (GameState.ballsToAddNewThisFrame.length > 0) {
    GameState.balls.push(...GameState.ballsToAddNewThisFrame);
  }
}
