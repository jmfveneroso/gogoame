import { drawSymbol } from "./drawing.js"; // Use the new function
import { symbolDefinitions, L1_SYMBOLS } from "./symbols.js";
import { Config } from "./config.js";
import { canvasWidth, canvasHeight, ctx } from "./ui.js";
import { GameState } from "./game_state.js";
import { destroyBall } from "./mechanics.js";

export class Ball {
  constructor(x, y, actualRadius, initialSymbolId, isBlack) {
    this.id = Date.now() + Math.random();
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = actualRadius;
    this.symbolId = initialSymbolId;
    this.level = symbolDefinitions[initialSymbolId].level;
    this.isGrabbed = false;
    this.slingshotVector = { x: 0, y: 0 };
    this.createdAt = Date.now();
    this.isSelected = false;
  }

  drawSlingshot() {
    if (
      this.isGrabbed &&
      (this.slingshotVector.x !== 0 || this.slingshotVector.y !== 0)
    ) {
      ctx.beginPath();
      ctx.strokeStyle = Config.slingshotArrowColor;
      ctx.lineWidth = 3;

      const arrowStartX = this.x;
      const arrowStartY = this.y;
      const arrowEndX = this.x + this.slingshotVector.x;
      const arrowEndY = this.y + this.slingshotVector.y;

      // Draw line
      ctx.moveTo(arrowStartX, arrowStartY);
      ctx.lineTo(arrowEndX, arrowEndY);

      // Draw arrowhead
      const angle = Math.atan2(
        arrowEndY - arrowStartY,
        arrowEndX - arrowStartX
      );
      ctx.lineTo(
        arrowEndX - 15 * Math.cos(angle - Math.PI / 6),
        arrowEndY - 15 * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(arrowEndX, arrowEndY);
      ctx.lineTo(
        arrowEndX - 15 * Math.cos(angle + Math.PI / 6),
        arrowEndY - 15 * Math.sin(angle + Math.PI / 6)
      );

      ctx.stroke();
      ctx.closePath();
    }
  }

  draw() {
    const symbolDef = symbolDefinitions[this.symbolId];

    // Draw the background circle
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = Config.levelColorsGray[this.level - 1] || "#ccc";
    ctx.fill();
    ctx.closePath();

    // Draw the text symbol on top
    drawSymbol(
      ctx,
      symbolDef.symbol,
      this.x,
      this.y,
      this.radius - 5,
      Config.symbolColor.normal
    );

    this.drawSlingshot();

    if (this.isSelected) {
      ctx.strokeStyle = Config.grabbedBallSymbolColor.normal; // Reuse the gold color
      ctx.lineWidth = 4;
      ctx.stroke(); // This will draw a gold ring around the existing circle
    }
  }

  applyGravity(cfg) {
    if (cfg.enableRealisticGravity) {
      // In realistic mode, gravity is a constant acceleration.
      // We still use the mass factor so heavier balls accelerate slower.
      let massFactor = this.radius / cfg.baseBallRadius;
      const fullMassEffect = 1 / massFactor;
      massFactor = 1 + (fullMassEffect - 1) * cfg.gravityMassEffect;
      this.vy += cfg.gravity * 0.1 * massFactor; // terminalVelocity now acts as acceleration
    } else {
      let massFactor = this.radius / cfg.baseBallRadius;
      const fullMassEffect = 1 / massFactor;
      massFactor = 1 + (fullMassEffect - 1) * cfg.gravityMassEffect;
      this.y += massFactor * cfg.gravity;
    }
  }

  applyFriction(cfg) {
    this.vx *= cfg.friction;
    this.vy *= cfg.friction;
  }

  // From wind curve.
  findClosestPointInWindCurve(cfg) {
    const curvePoints = GameState.windCurve.points;

    let closestDist = Infinity;
    let closestPoint = null;
    let curveDirection = { x: 0, y: 0 };
    let segmentIndex = -1; // NEW: Keep track of which segment is closest

    // 1. Find the closest point on the entire wind curve to the ball
    for (let i = 0; i < curvePoints.length - 1; i++) {
      const p1 = curvePoints[i];
      const p2 = curvePoints[i + 1];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;

      if (dx === 0 && dy === 0) continue;

      const t =
        ((this.x - p1.x) * dx + (this.y - p1.y) * dy) / (dx * dx + dy * dy);

      let currentClosest;
      if (t < 0) {
        currentClosest = p1;
      } else if (t > 1) {
        currentClosest = p2;
      } else {
        currentClosest = { x: p1.x + t * dx, y: p1.y + t * dy };
      }

      const dist = Math.sqrt(
        (this.x - currentClosest.x) ** 2 + (this.y - currentClosest.y) ** 2
      );

      if (dist < closestDist) {
        closestDist = dist;
        closestPoint = currentClosest;
        const mag = Math.sqrt(dx * dx + dy * dy);
        curveDirection = { x: dx / mag, y: dy / mag };
        segmentIndex = i; // Store the index of the closest segment
      }
    }

    if (
      closestDist < cfg.windInfluenceRadius ||
      (this.isCapturedByWindTimer !== null &&
        Date.now() < this.isCapturedByWindTimer)
    ) {
      return [closestPoint, closestDist, segmentIndex, curveDirection];
    }
    return [null, Infinity, -1, curveDirection];
  }

  applyWindForce(cfg) {
    if (Date.now() < this.windImmuneUntil) return;
    if (!GameState.windCurve) return;
    if (this.symbolId === "S1_VOID") return;

    const curvePoints = GameState.windCurve.points;
    if (curvePoints.length < 2) return;

    let [closestPoint, closestDist, segmentIndex, curveDirection] =
      this.findClosestPointInWindCurve(cfg);

    // 2. If the closest point is within the influence radius, apply forces
    if (closestPoint && segmentIndex !== -1) {
      this.gravityImmuneUntil =
        Date.now() +
        cfg.windGravityImmunityDuration +
        cfg.levitationLevelMultiplier * this.level;

      let massFactor = this.radius / cfg.baseBallRadius;
      const fullMassEffect = 1 / massFactor;
      massFactor = 1 + (fullMassEffect - 1) * cfg.gravityMassEffect;

      const progress = segmentIndex / (curvePoints.length - 1);

      const falloff = 1.0 - progress * cfg.windForceFalloff;
      const strengthMultiplier = Math.max(0, falloff); // Ensure strength doesn't go below zero

      let curvatureMultiplier = 1.0; // Default to no extra force for straight lines

      // Check if there is a "next" segment to calculate a turn
      if (segmentIndex < curvePoints.length - 2) {
        const nextSegmentP1 = curvePoints[segmentIndex + 1];
        const nextSegmentP2 = curvePoints[segmentIndex + 2];
        const nextDx = nextSegmentP2.x - nextSegmentP1.x;
        const nextDy = nextSegmentP2.y - nextSegmentP1.y;
        const nextMag = Math.sqrt(nextDx * nextDx + nextDy * nextDy);

        if (nextMag > 0) {
          const nextCurveDirection = {
            x: nextDx / nextMag,
            y: nextDy / nextMag,
          };

          // 1. Calculate the dot product between the current direction and the next.
          // A value of 1 means they are parallel (straight); a value closer to 0 means a sharp turn.
          const dotProduct =
            curveDirection.x * nextCurveDirection.x +
            curveDirection.y * nextCurveDirection.y;

          // 2. Create a multiplier that is high for sharp turns and low for straight lines.
          // (1.0 - dotProduct) gives us a value from 0 (straight) to 1 (90-degree turn).
          // We scale this by the config factor to control the intensity.
          curvatureMultiplier =
            1.0 + (1.0 - dotProduct) * cfg.couplingCurvatureFactor;
        }
      }

      const normalDx = closestPoint.x - this.x;
      const normalDy = closestPoint.y - this.y;

      const lengthRampUp =
        (curvePoints.length || !Config.enableCouplingFourceRampDown) > 10
          ? 1
          : 0;
      let couplingForce = cfg.windCouplingStrength;

      // If the ball is within the arrival distance, ramp down the force.
      if (closestDist < cfg.windArrivalDistance) {
        // This creates a scaling factor from 0 to 1 inside the arrival zone.
        couplingForce *= closestDist / cfg.windArrivalDistance;
      }

      // Apply the smoothly ramped coupling force.

      this.vx +=
        normalDx *
        couplingForce *
        strengthMultiplier *
        massFactor *
        curvatureMultiplier;
      this.vy +=
        normalDy *
        couplingForce *
        strengthMultiplier *
        massFactor *
        curvatureMultiplier;

      // B. The Tangential Force (Propulsion) - Guides the ball's SPEED along the line
      const speedAlongCurve =
        this.vx * curveDirection.x + this.vy * curveDirection.y;

      if (speedAlongCurve < cfg.windMaxSpeed) {
        const curveLength = GameState.windCurve.totalLength || 0;
        const dynamicStrength =
          cfg.windBaseStrength + (curveLength / 100) * cfg.windStrengthPer100px;

        const forceMagnitude =
          (cfg.windMaxSpeed - speedAlongCurve) * dynamicStrength;

        // Apply the falloff multiplier to the tangential force
        this.vx +=
          curveDirection.x * forceMagnitude * strengthMultiplier * massFactor;
        this.vy +=
          curveDirection.y * forceMagnitude * strengthMultiplier * massFactor;
      }

      this.isCapturedByWind = true;
      this.isCapturedByWindTimer = Date.now() + Config.windCaptureTimer;
      this.hasBeenManipulated = true;
    }
  }

  doVerticalBoundaryCheck(cfg) {
    if (this.y > 50 || this.hasBeenInPlayfield) {
      this.hasBeenInPlayfield = true;
    }

    const collidesTop = this.y - this.radius < 0 && this.hasBeenInPlayfield;

    const collidesBottom = this.y + this.radius > canvasHeight;

    if (collidesTop || collidesBottom) {
      const knockbackSource = {
        x: this.x,
        // Knockback comes from beyond the wall that was hit
        y: collidesTop ? -this.radius : canvasHeight + this.radius,
      };

      const dx = this.x - knockbackSource.x;
      const dy = this.y - knockbackSource.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        this.vx = (dx / distance) * Config.knockback;
        this.vy = (dy / distance) * Config.knockback;
      } else {
        this.vy = -Config.knockback; // Fallback
      }

      if (collidesBottom) {
        destroyBall(this, "vertical");
        return true;
      }
    }

    return false;
  }

  doHorizontalBoundaryCheck(cfg) {
    const collidesLeft = this.x - this.radius < 0;
    const collidesRight = this.x + this.radius > canvasWidth;

    if (collidesLeft || collidesRight) {
      const knockbackSource = {
        x: collidesLeft ? -this.radius : canvasWidth + this.radius,
        y: this.y,
      };

      const dx = this.x - knockbackSource.x;
      const dy = this.y - knockbackSource.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        this.vx = (dx / distance) * Config.knockback;
        this.vy = (dy / distance) * Config.knockback;
      } else {
        this.vy = -Config.knockback; // Fallback
      }

      return false;
    }

    return false;
  }

  applyGrab() {
    this.x += this.vx;
    this.y += this.vy;
    this.x = Math.max(this.radius, Math.min(this.x, canvasWidth - this.radius));
    this.y = Math.max(
      this.radius,
      Math.min(this.y, canvasHeight - this.radius)
    );
    if (this.x === this.radius || this.x === canvasWidth - this.radius)
      this.vx = 0;
    if (this.y === this.radius || this.y === canvasHeight - this.radius)
      this.vy = 0;
  }

  update(cfg) {
    if (this.isGrabbed) {
      // When grabbed, the ball doesn't move on its own
      return true;
    }

    this.applyGravity(cfg);
    this.applyWindForce(cfg);
    this.applyFriction(cfg);

    this.y += this.vy;
    this.x += this.vx;

    if (
      this.doVerticalBoundaryCheck(cfg) ||
      this.doHorizontalBoundaryCheck(cfg)
    ) {
      return false;
    }

    return true;
  }
}
