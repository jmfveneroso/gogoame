export const baseConfig = {
  baseBallRadius: 14,
  ballCreationInterval: 800,
  gravity: 0.15,
  friction: 0.985,
  sizeIncreasePerLevel: 0.1,
  gravityMassEffect: 1.0,
  MAX_SYMBOL_LEVEL: 10,
  knockback: 1,
  enableRealisticGravity: true,

  // Combine by click.
  combineClick: false,
  combineInMiddle: true,

  // Slingshot.
  enableSlingshot: true,
  reverseSlingshot: true,
  slingshotMaxStrength: 150, // The maximum pull distance for the slingshot
  slingshotPowerMultiplier: 0.1, // How much velocity is applied from the pull
  slingshotArrowColor: "rgba(255, 223, 0, 0.7)", // A bright yellow for the aiming arrow

  // Wind parameters.
  drawWindCurve: true,
  windBaseLifetime: 0, // How long the curve lasts in ms
  windLifetimePerPixel: 3,
  windInfluenceRadius: 28, // How close a ball must be to the curve to be affected
  windMaxSpeed: 3.5, // The target speed for balls caught in the wind
  windBaseStrength: 0.0, // The minimum strength of any wind curve
  windStrengthPer100px: 0.03,
  windMaxWidth: 12, // The width of the stroke at its start in pixels
  windMinWidth: 2, // The width of the stroke at its end
  minPointDistance: 10, // Minimum distance between points on the curve to be recorded
  couplingCurvatureFactor: 60,
  windCouplingStrength: 0.015,
  windArrivalDistance: 100, // Distance (in pixels) from the curve to start slowing down
  windForceFalloff: 1.0,
  couplingSpeedFactor: 0.04,
  windSmoothingFactor: 0.5,
  windShadowBlur: 15,
  windCaptureTimer: 500,
  enableAngleSnapping: true,
  maxWindCurveAngle: 120, // The maximum angle (in degrees) allowed before the curve breaks.
  windAngleLookback: 4,

  // STYLE INFORMATION.
  enableBallBorder: true,
  enableBallFill: true,
  invertColors: false,
  strokeColors: false,
  constructionAnimationDuration: 400,

  // Canvas background is a special case, handled in script.js, but we'll define it here.
  backgroundColor: {
    normal: "#444",
    inverted: "#dde1e6",
    patternColor: "rgba(128, 128, 128, 0.04)", // Subtle gray for the waves
  },

  // Symbol Colors
  symbolColor: { normal: "#FFFFFF", inverted: "#000000" },
  grabbedBallSymbolColor: { normal: "#f1c40f", inverted: "#2980b9" }, // Gold -> Strong Blue

  // Particle & Effect Colors
  windFillColor: {
    normal: "rgba(220, 235, 255, 0.7)",
    inverted: "rgba(50, 50, 80, 0.6)",
  },

  levelColorsGray: [
    "rgba(52, 152, 219, 0.7)", // L1: Blue
    "rgba(142, 68, 173, 0.7)", // L2: Purple
    "rgba(230, 126, 34, 0.7)", // L3: Orange
    "rgba(241, 196, 15, 0.7)", // L4: Yellow/Gold
    "rgba(168, 204, 52, 0.7)", // L5: Lime
    "rgba(231, 76, 60, 0.7)", // L6: Red
    "rgba(190, 190, 190, 0.7)", // L7: Silver
    "rgba(0, 150, 100, 0.7)", // L8: Emerald
    "rgba(255, 0, 255, 0.7)", // L9: Pink
    "rgba(0, 0, 0, 1.0)", // L10: Black
  ],

  mandalaInnerRadius: 0.0, // The initial upward velocity
  mandalaCurveAmount: 0.35, // The initial upward velocity

  numberOfSymbolTypes: 3, // Can be 3 or 4
};

const mobileOverrides = {
  terminalVelocity: 0.4,
  ballCreationInterval: 1300,
  baseBallRadius: 11,
  Debris_Particle_Speed: 0.5,
  voidSymbolSpawnRate: 0.15,
  voidParticleCount: 83,
  windMaxSpeed: 2.5, // The target speed for balls caught in the wind
  enableCouplingFourceRampDown: false,
  friction: 0.98,
  friction: 0.98,
  windBaseStrength: 0.0, // The minimum strength of any wind curve
  windStrengthPer100px: 0.05,
  windLifetimePerPixel: 6,
};

const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;

export const Config = isMobile
  ? { ...baseConfig, ...mobileOverrides }
  : baseConfig;
