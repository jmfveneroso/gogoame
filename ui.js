import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { destroyBall } from "./mechanics.js";

import { resetBallCreationTimer } from "./environment.js";

const controlsPanel = document.querySelector(".controls");
export const canvas = document.getElementById("gameCanvas");
export const ctx = canvas.getContext("2d");
export let canvasWidth = window.innerWidth;
export let canvasHeight = window.innerHeight;

const dpr = window.devicePixelRatio || 1;

// 2. Set the canvas's drawing buffer to the high-resolution size.
canvas.width = canvasWidth * dpr;
canvas.height = canvasHeight * dpr;

// 3. Use CSS to scale the canvas element back down to the logical size.
canvas.style.width = `${canvasWidth}px`;
canvas.style.height = `${canvasHeight}px`;

// 4. Scale the main drawing context. All drawing operations will now be scaled up.
ctx.scale(dpr, dpr);

const rangeFactor = 10;

const configurableParams = [
  ["gravity", 0.05],
  ["friction", 0.005],
  ["baseBallRadius", 1],
  ["ballCreationInterval", 100],
  ["enableSlingshot", "toggle"],
  ["reverseSlingshot", "toggle"],
  ["combineClick", "toggle"],
  ["enableRealisticGravity", "toggle"],
];

function resizeCanvas() {
  // CHANGE these two lines
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight; // The canvas should always fill the window

  // This logic is incorrect for an overlay panel and should be removed:
  // canvasHeight = window.innerHeight - controlsPanel.offsetHeight - 10;

  if (canvasHeight < 50) canvasHeight = 50; // This check can be removed or kept as a safeguard
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
}

export function clearCanvas() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
}

/**
 * Generic handler for any slider change.
 * Updates the Config object and the value display span.
 * @param {Event} event
 */
function handleSliderChange(event) {
  const slider = event.target;
  const paramName = slider.id;
  const value = parseFloat(slider.value);
  const decimals = parseInt(slider.dataset.decimals, 10);

  // Update the global Config object
  Config[paramName] = value;

  // Update the corresponding value display
  const valueSpan = document.getElementById(`${paramName}Value`);
  if (valueSpan) {
    valueSpan.textContent = value.toFixed(decimals);
  }
}

function handleCheckboxChange(event) {
  const checkbox = event.target;
  Config[checkbox.id] = checkbox.checked;
}

function handleIntervalChange(event) {
  const slider = event.target;
  const value = parseInt(slider.value, 10);

  // 1. Update the Config object
  Config.ballCreationInterval = value;

  // 2. Update the display span
  const valueSpan = document.getElementById(`${slider.id}Value`);
  if (valueSpan) {
    valueSpan.textContent = value;
  }

  // 3. Call the function to reset the actual game timer
  resetBallCreationTimer();
}

function camelCaseToTitleCase(text) {
  // Insert a space before any uppercase letter
  const withSpaces = text.replace(/([A-Z])/g, " $1");
  // Capitalize the first letter and return
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

/**
 * Generates all UI slider controls programmatically based on the configurableParams array.
 */
function generateUiControls() {
  controlsPanel.innerHTML = ""; // Clear any existing controls

  configurableParams.forEach(([name, step]) => {
    const initialValue = Config[name];

    // Create the container div
    const group = document.createElement("div");
    group.className = "ctrl-div";

    // Create the label
    const label = document.createElement("label");
    label.setAttribute("for", name);
    label.textContent = camelCaseToTitleCase(name) + ":";
    group.appendChild(label);

    if (step === "toggle") {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = name;
      checkbox.checked = Config[name];

      checkbox.addEventListener("change", handleCheckboxChange);
      group.appendChild(checkbox);
    } else {
      // Create the range slider input
      const slider = document.createElement("input");
      slider.type = "range";
      slider.id = name;
      slider.value = initialValue;
      slider.step = step;

      const initialValueString = initialValue.toString();
      let decimals = initialValueString.includes(".")
        ? initialValueString.split(".")[1].length
        : 0;
      const stepValueString = step.toString();
      const stepDecimals = stepValueString.includes(".")
        ? stepValueString.split(".")[1].length
        : 0;
      slider.dataset.decimals = Math.max(decimals, stepDecimals);

      // Calculate min/max range around the initial value
      const range = rangeFactor * step;
      slider.min = Math.max(0, initialValue - range);
      slider.max = initialValue + range;

      if (name === "ballCreationInterval") {
        slider.addEventListener("input", handleIntervalChange);
      } else {
        slider.addEventListener("input", handleSliderChange);
      }
      group.appendChild(slider);

      // Create the value display span
      const valueSpan = document.createElement("span");
      valueSpan.id = `${name}Value`;
      valueSpan.textContent = initialValue.toFixed(decimals);
      group.appendChild(valueSpan);
    }

    // Add the completed group to the controls panel
    controlsPanel.appendChild(group);
  });
}

export function addUiEvents() {
  // Add the button to the bottom of the controls panel
  generateUiControls();
  resizeCanvas();

  // Get references to the buttons AFTER they have been created
  const expandBtn = document.getElementById("expand-controls-btn");

  // Add events to toggle the panel's visibility
  expandBtn.addEventListener("click", () => {
    controlsPanel.classList.toggle("hidden");
  });

  window.addEventListener("resize", resizeCanvas);
}
