import { log, truncateMessageHistory } from './utils.js';
import { SYSTEM_PROMPT } from './settings.js';

/**
 * Send a message to the LLM service and get a response
 * @param {Object} params - Message parameters
 * @param {String} params.message - The user's message
 * @param {Array} [params.history] - Previous message history
 * @param {String} [params.model] - The model to use
 * @returns {Promise<String>} - The AI response
 */
export async function sendMessage(params) {
  // Get settings
  const useHttps = game.settings.get('divination', 'https');
  const apiUrl = (useHttps ? 'https://' : 'http://') + game.settings.get('divination', 'textGenerationApiUrl');
  const apiKey = game.settings.get('divination', 'apiKey');
  const payloadTemplate = game.settings.get('divination', 'payloadJson');
  const responseJsonPath = game.settings.get('divination', 'responseJsonPath');
  const reasoningEndTag = game.settings.get('divination', 'reasoningEndTag');
  const reasoningDisplay = game.settings.get('divination', 'reasoningDisplay');
  const historyLimit = game.settings.get('divination', 'messageHistory');
  const globalContext = game.settings.get('divination', 'globalContext');
  
  // Use default model if not specified
  const model = params.model || game.settings.get('divination', 'models').split(',')[0].trim();
  
  // Prepare message history
  let messages = params.history || [];
  
  // Add global context if it exists
  if (globalContext && globalContext.trim() !== '') {
    // If we don't have a system message yet, add global context to a new one
    const systemMessage = messages.find(m => m.role === 'system');
    
    if (!systemMessage) {
      messages.unshift({
        role: 'system',
        content: globalContext
      });
    } else {
      // If we already have a system message and global context has changed,
      // update the system message to include the global context
      const existingContent = systemMessage.content;
      if (!existingContent.includes(globalContext)) {
        systemMessage.content = `${globalContext}\n\n${existingContent}`;
      }
    }
  }
  
  // Format conversation history into a structured context
  // We'll do this only if we have multiple messages for context
  let contextualHistory = "";
  if (messages.length > 1) {
    // Create a formatted history string excluding system messages
    // This will be used for context in templates that don't support full message objects
    const historyMessages = messages.filter(m => m.role !== 'system');
    
    if (historyMessages.length > 0) {
      contextualHistory = "Previous conversation:\n\n" + 
        historyMessages.map(m => {
          const role = m.role === 'user' ? 'User' : 'Assistant';
          // Strip HTML tags for plain text context
          const content = m.content.replace(/<[^>]*>?/gm, '');
          return `${role}: ${content}`;
        }).join('\n\n');
    }
  }
  
  // Add the new message
  messages.push({
    role: 'user',
    content: params.message
  });
  
  // Truncate history if needed
  if (historyLimit > 0) {
    messages = truncateMessageHistory(messages, historyLimit);
  }
  
  // Convert messages to string for template replacement
  const messagesStr = JSON.stringify(messages);
  
  // Log the template before replacement
  console.log("Divination | Original payload template length:", payloadTemplate.length);
  
  // Check for potential issues in the payload template
  if (payloadTemplate.includes('\u0000')) {
    console.warn("Divination | Warning: Payload template contains null characters");
    payloadTemplate = payloadTemplate.replace(/\u0000/g, '');
  }
  
  // Prepare the replacements object with all potential variables
  const replacements = {
    'Model': model,
    'UserMessage': contextualHistory ? `${contextualHistory}\n\nUser: ${params.message}` : params.message,
    'MessageHistory': messages, // Pass the object directly for proper JSON handling
    'SystemMessage': globalContext || SYSTEM_PROMPT,
    'Context': contextualHistory // Add the formatted context as a separate variable
  };
  
  // Use the helper function to safely replace all variables
  let filledTemplate = replaceTemplateVariables(payloadTemplate, replacements);
  
  // Log the result of the replacement
  console.log("Divination | Filled template length:", filledTemplate.length);
  
  // Check for unprocessed template variables
  const remainingVars = filledTemplate.match(/{{.*?}}/g);
  if (remainingVars) {
    console.warn("Divination | Warning: Template still contains unprocessed variables:", remainingVars);
  }
  
  // Parse the payload JSON
  let payload;
  try {
    // Log the template for debugging
    console.log("Divination | Template before parsing:", filledTemplate);
    
    // Remove any BOM or special invisible characters
    filledTemplate = filledTemplate.trim().replace(/^\ufeff/g, "");
    
    // Try to parse the JSON carefully
    try {
      payload = JSON.parse(filledTemplate);
      console.log("Divination | Successfully parsed JSON template");
    } catch (initialError) {
      // If parsing fails, try to clean the template further
      log({
        message: "Initial JSON parsing error, attempting to clean template further",
        error: initialError,
        type: ["warn"]
      });
      
      // Log details about the error position
      const errorMatch = initialError.message.match(/position (\d+)/);
      if (errorMatch) {
        const errorPos = parseInt(errorMatch[1]);
        console.error(`Divination | JSON error at position ${errorPos}`);
        
        // Log characters around the error position
        const start = Math.max(0, errorPos - 20);
        const end = Math.min(filledTemplate.length, errorPos + 20);
        console.error(`Divination | Characters around error position: "${filledTemplate.substring(start, end)}"`);
        console.error(`Divination | Character at position: "${filledTemplate.charAt(errorPos)}"`);
        
        // Check specific positions mentioned in the error
        if (errorPos === 467) {
          console.error(`Divination | Character at position 467: "${filledTemplate.charAt(467)}" (char code: ${filledTemplate.charCodeAt(467)})`);
          // If there's a specific character causing issues, try to replace it
          filledTemplate = filledTemplate.substring(0, 467) + filledTemplate.substring(468);
          console.error("Divination | Tried removing problematic character at position 467");
        }
      }
      
      // More aggressive cleaning for JSON safety
      const cleanedTemplate = filledTemplate
        .replace(/\r\n/g, '\n')         // Normalize line endings to LF
        .replace(/\\/g, '\\\\')         // Double escape all backslashes first
        .replace(/\\\\n/g, '\\n')       // Fix double-escaped newlines
        .replace(/\\\\t/g, '\\t')       // Fix double-escaped tabs
        .replace(/\\\\"/g, '\\"')       // Fix double-escaped quotes
        .replace(/(['"])\s*:\s*/g, '$1:') // Normalize spacing around colons
        .replace(/,\s*}/g, '}')         // Remove trailing commas in objects
        .replace(/,\s*\]/g, ']');       // Remove trailing commas in arrays
      
      try {
        payload = JSON.parse(cleanedTemplate);
        console.log("Divination | Successfully parsed cleaned template");
      } catch (secondError) {
        // Still failing, try using a robust method to create a valid JSON object
        log({
          message: "Cleaned template still fails to parse, using fallback",
          error: secondError,
          type: ["warn"]
        });
        
        // Just use a simple valid payload as fallback
        throw secondError; // Let the outer catch handle it
      }
    }
  } catch (error) {
    log({
      message: "Error parsing payload JSON template.",
      error: error,
      type: ["error"]
    });
    
    // Create a simple valid payload as fallback
    payload = {
      model: model,
      messages: messages
    };
    
    log({
      message: "Using fallback payload due to parse error",
      type: ["warn"]
    });
  }
  
  // For templates that don't use {{MessageHistory}}, try to insert messages array
  if (!payloadTemplate.includes('{{MessageHistory}}') && payload.messages) {
    // If the template has a direct messages array but doesn't use {{MessageHistory}},
    // we'll replace it with our prepared messages
    payload.messages = messages;
  }
  
  // Set up headers
  const headers = {
    "Content-Type": "application/json"
  };
  
  // Add authorization if we have an API key
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  
  // Make the API request
  let response = null;
  let tries = 0;
  const maxTries = 3; // Fixed maximum retry count
  let error = null;
  
  while (tries < maxTries && !response) {
    tries++;
    try {
      const fetchResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
      
      if (!fetchResponse.ok) {
        error = new Error(`HTTP error ${fetchResponse.status}`);
        log({
          message: `API request failed (attempt ${tries}/${maxTries})`,
          error: error,
          type: ["warn"]
        });
        continue;
      }
      
      const data = await fetchResponse.json();
      
      // Extract the response text using the path from settings
      response = responseJsonPath.split('.').reduce((o, i) => o[i], data);
      
      // If no response content was found, throw an error
      if (!response) {
        error = new Error(`No content found at path ${responseJsonPath}`);
        log({
          message: `Failed to extract response content (attempt ${tries}/${maxTries})`,
          error: error,
          type: ["warn"]
        });
        response = null; // Reset to try again
      }
    } catch (e) {
      error = e;
      log({
        message: `Error sending message (attempt ${tries}/${maxTries})`,
        error: error,
        type: ["warn"]
      });
    }
    
    // Wait before retrying
    if (!response && tries < maxTries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // If all tries failed, throw the last error
  if (!response) {
    log({
      message: "All attempts to get a response failed",
      error: error,
      type: ["error"]
    });
    throw error || new Error("Failed to get a response from the API");
  }
  
  // Process reasoning if a reasoning end tag is set
  let reasoning = "";
  let formattedResponse = response;
  
  if (reasoningEndTag && reasoningEndTag.trim() !== '') {
    const parts = response.split(reasoningEndTag);
    
    if (parts.length > 1) {
      reasoning = parts[0].trim();
      formattedResponse = parts.slice(1).join(reasoningEndTag).trim();
      
      // Format based on reasoning display preference
      if (reasoningDisplay === "hide") {
        // Don't include reasoning at all
      } else if (reasoningDisplay === "truncate") {
        // Create a truncated preview with expand option
        const maxPreview = 100;
        const preview = reasoning.length > maxPreview 
          ? reasoning.substring(0, maxPreview) + '...' 
          : reasoning;
          
        formattedResponse = `<div class="divination-reasoning">
          <div class="divination-reasoning-header">
            <span>AI Reasoning</span>
            <button class="divination-toggle-reasoning">Show/Hide</button>
          </div>
          <div class="divination-reasoning-preview">${preview}</div>
          <div class="divination-reasoning-full" style="display: none;">${reasoning}</div>
        </div>
        <div class="divination-response">${formattedResponse}</div>`;
      } else {
        // Show reasoning fully
        formattedResponse = `<div class="divination-reasoning">
          <div class="divination-reasoning-header">
            <span>AI Reasoning</span>
            <button class="divination-toggle-reasoning">Show/Hide</button>
          </div>
          <div class="divination-reasoning-full">${reasoning}</div>
        </div>
        <div class="divination-response">${formattedResponse}</div>`;
      }
    }
  }
  
  // Add the response to history for future use - use unformatted response for history
  messages.push({
    role: 'you',
    content: response
  });
  
  return {
    content: formattedResponse,
    rawContent: response,
    reasoning: reasoning,
    history: messages
  };
}

/**
 * Helper function to safely replace template variables in a JSON string
 * This ensures that variable values are properly escaped for JSON inclusion
 * @param {string} template - The JSON template with variables
 * @param {Object} replacements - Object with variable name to value mappings
 * @returns {string} - The filled template with variables replaced
 */
function replaceTemplateVariables(template, replacements) {
  let result = template;
  
  // For each replacement pair
  for (const [variable, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`{{${variable}}}`, 'g');
    
    // If the value is already a string, ensure it's properly escaped for JSON
    if (typeof value === 'string') {
      // Escape the string as if it were going into JSON, but without the outer quotes
      const escapedValue = JSON.stringify(value).slice(1, -1);
      result = result.replace(pattern, escapedValue);
    } 
    // For objects or arrays, stringify them first (they'll be inserted as JSON text)
    else if (typeof value === 'object') {
      const jsonValue = JSON.stringify(value);
      // Remove the outer quotes since this will be inserted into a JSON string
      result = result.replace(pattern, jsonValue);
    } 
    // For primitives like numbers or booleans, just convert to string
    else {
      result = result.replace(pattern, String(value));
    }
  }
  
  return result;
} 