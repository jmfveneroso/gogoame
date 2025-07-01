/**
 * symbols.js - Loads and processes symbol data from an external JSON file.
 */

// This object will be populated after fetching the data.
export let symbolDefinitions = {};
export let L1_SYMBOLS = [];

/**
 * Fetches and processes the symbols from the JSON file.
 */
export async function loadSymbols() {
  const response = await fetch("./symbols.json");
  const symbolsArray = await response.json();

  // Convert the array into a more useful object, keyed by ID
  symbolsArray.forEach((symbol) => {
    symbolDefinitions[symbol.id] = symbol;
  });

  // Populate the list of Level 1 symbols for spawning
  L1_SYMBOLS = symbolsArray
    .filter((symbol) => symbol.level === 1)
    .map((symbol) => symbol.id);

  console.log("Symbols loaded and processed.");
}
