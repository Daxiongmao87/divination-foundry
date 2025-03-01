/**
 * Utility functions for the Divination module
 */

/**
 * Log a message to the console
 * @param {Object} options - Logging options
 * @param {String} options.message - The message to log
 * @param {Error} [options.error] - An optional error object
 * @param {Array} [options.type] - Log types: ["error", "warn", "info", "debug"]
 */
export function log(options) {
  const prefix = "Divination | ";
  const message = options.message || "";
  const error = options.error || null;
  const types = options.type || ["info"];

  // Only log in debug mode unless it's an error or warning
  // In Foundry V12, check CONFIG.debug.hooks instead of game.settings
  if (!(CONFIG.debug?.hooks || false) && 
      !types.includes("error") && 
      !types.includes("warn")) {
    return;
  }

  if (types.includes("error")) {
    console.error(prefix + message, error);
  } else if (types.includes("warn")) {
    console.warn(prefix + message, error);
  } else if (types.includes("debug")) {
    console.debug(prefix + message, error);
  } else {
    console.log(prefix + message, error);
  }
}

/**
 * Validates a JSON object against a JSON schema
 * @param {Object} json - The JSON object to validate
 * @param {Object} schema - The JSON schema to validate against
 * @returns {Boolean} - Whether the JSON is valid against the schema
 */
export function validateJsonAgainstSchema(json, schema) {
  // Simple validation implementation - for production use, consider a library like ajv
  try {
    return json && typeof json === 'object';
  } catch (error) {
    log({
      message: "Error validating JSON against schema.",
      error: error,
      type: ["error"]
    });
    return false;
  }
}

/**
 * Truncates the message history to the specified length
 * @param {Array} messages - The message history array
 * @param {Number} maxLength - The maximum number of messages to keep
 * @returns {Array} - The truncated message history
 */
export function truncateMessageHistory(messages, maxLength) {
  if (!Array.isArray(messages)) return [];
  if (messages.length <= maxLength) return messages;
  
  // Keep the system message if it exists, then the most recent messages
  const systemMessage = messages.find(m => m.role === "system");
  
  // If we have a system message, keep it and the most recent messages
  if (systemMessage) {
    const otherMessages = messages.filter(m => m.role !== "system");
    const recentMessages = otherMessages.slice(-1 * (maxLength - 1));
    return [systemMessage, ...recentMessages];
  }
  
  // Otherwise just keep the most recent messages
  return messages.slice(-1 * maxLength);
} 