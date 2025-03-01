import { log } from './utils.js';

export const SYSTEM_PROMPT="You are a helpful assistant in a tabletop roleplaying game. Provide concise, useful information and ideas that enhance the game experience. When appropriate, frame your responses in a way that fits within the fantasy setting, but also be clear and direct when giving rules information or practical advice."

/**
 * Registers the module's settings in Foundry VTT.
 */
export function registerSettings() {
    /**
     * Default payload JSON for API calls
     */
    const defaultPayloadJson = `{
  "model": "{{Model}}",
  "messages": [
    {
      "role": "system",
      "content": "${SYSTEM_PROMPT}"
    },
    {
      "role": "user",
      "content": "{{UserMessage}}"
    }
  ]
}`

    // UI Customization Settings
    game.settings.register('divination', 'assistantName', {
        name: "Assistant Name",
        hint: "The name that will be displayed for the AI assistant in the chat interface.",
        scope: 'world',
        config: true,
        type: String,
        default: "Divination"
    });

    game.settings.register('divination', 'assistantAvatar', {
        name: "Assistant Avatar",
        hint: "The image that will be displayed for the AI assistant in the chat interface.",
        scope: 'world',
        config: true,
        type: String,
        default: "modules/divination/assets/divination.png",
        filePicker: "image"
    });

    // API Configuration Settings
    game.settings.register('divination', 'https', {
        name: 'Enable HTTPS',
        hint: 'Whether to use HTTPS or HTTP for the API URL. Disable this if using localhost',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register('divination', 'textGenerationApiUrl', {
        name: 'Text Generation API URL',
        hint: 'Enter the target URL for the text generation API endpoint.',
        scope: 'world',
        config: true,
        type: String,
        default: 'api.openai.com/v1/chat/completions',
    });

    game.settings.register('divination', 'apiKey', {
        name: "API Key",
        hint: "Enter your API key here. (optional for some endpoints)",
        scope: 'world',
        config: true,
        type: String,
        default: ""
    });

    game.settings.register('divination', 'models', {
        name: "Available Models",
        hint: "Enter the models available for text generation in a comma-delimited list. The first model will be used by default.",
        scope: 'world',
        config: true,
        type: String,
        default: "gpt-4o, gpt-3.5-turbo"
    });

    game.settings.register('divination', 'payloadJson', {
        name: "Payload JSON",
        hint: "Enter the JSON payload template for the API request.",
        scope: 'world',
        config: true,
        type: String,
        default: defaultPayloadJson
    });

    game.settings.register('divination', 'responseJsonPath', {
        name: "Response JSON Path",
        hint: "Enter the path to the response JSON in dot notation.",
        scope: 'world',
        config: true,
        type: String,
        default: 'choices.0.message.content'
    });

    game.settings.register('divination', 'reasoningEndTag', {
        name: "Reasoning End Tag",
        hint: "Tag that indicates the end of the AI's reasoning section (e.g., '##RESPONSE##'). Leave empty if your AI doesn't provide reasoning.",
        scope: 'world',
        config: true,
        type: String,
        default: ''
    });

    game.settings.register('divination', 'reasoningDisplay', {
        name: "Reasoning Display",
        hint: "How to display the AI reasoning section when present.",
        scope: 'world',
        config: true,
        type: String,
        choices: {
            "hide": "Hide completely",
            "truncate": "Show snippet with expand option",
            "show": "Always show fully"
        },
        default: "truncate"
    });

    game.settings.register('divination', 'messageHistory', {
        name: "Message History Length",
        hint: "Number of messages to include in context (0 for no history)",
        scope: 'world',
        config: true,
        type: Number,
        default: 10
    });

    game.settings.register('divination', 'globalContext', {
        name: "Global Context",
        hint: "Additional context that will be considered in all conversations.",
        scope: 'world',
        config: true,
        type: String,
        default: ''
    });

    // Register permission for using Divination
    game.settings.register('divination', 'permission', {
        name: "Permission Level",
        hint: "The minimum permission level required to use Divination",
        scope: 'world',
        config: false, // Not shown in settings (managed through permissions UI)
        type: String,
        default: "ASSISTANT"
    });

    // Handle permissions setup for different Foundry versions
    try {
        // For D&D 5e system, we can add a permission to its config if available
        if (game.system?.id === 'dnd5e' && CONFIG.DND5E?.permissions) {
            CONFIG.DND5E.permissions.divination = "PLAYER"; // Default to PLAYER permission
        } 
        
        log({message: "Divination permissions set up successfully"});
    } catch (error) {
        console.error("Divination | Error setting up permissions:", error);
    }
    
    log({message: "Divination settings registered successfully."});
}

/**
 * Check if a user has permission to use Divination
 * @param {User} user - The user to check
 * @returns {boolean} - Whether the user has permission
 */
export function hasPermission(user) {
    // Safety check if game is not fully initialized
    if (!game?.user) return false;
    
    // GM always has permission
    if (user.isGM) return true;
    
    try {
        // Get the permission setting (default to ASSISTANT if not set)
        const requiredPermission = game.settings.get('divination', 'permission') || "ASSISTANT";
        
        // For D&D 5e, we can use the permissions system if available
        if (game.system?.id === 'dnd5e' && CONFIG.DND5E?.permissions?.divination) {
            return user.role >= CONST.USER_ROLES[requiredPermission];
        }
        
        // Default to checking against the user's role
        return user.role >= CONST.USER_ROLES[requiredPermission];
    } catch (e) {
        console.warn("Divination | Permission check failed, defaulting to false", e);
        // Default to only GM having access
        return user.isGM;
    }
}

/**
 * Hook to place a call-to-action panel in the settings section with links to documentation
 */
Hooks.on('renderPackageConfiguration', (app, html, data) => {
    const ctaPanel = $(`
        <div style="border: solid; border-width: 1px; padding: 0.75rem; padding-bottom: 0.25rem; border-radius:8px; border-color: #5d142b; margin-bottom:1rem; background-color: rgba(255,255,255,0.35);">
            <h4><b> <i class="fa-regular fa-circle-question"></i> Need Help?</b></h4>
            <p>Visit Divination's <a href="https://www.github.com/Daxiongmao87/divination-foundry">Github Repository</a> for information on these settings.</p>
        </div>
        `);
    const apiModal = $(html).find("[data-tab='divination']").find('h2').first();
    //we need to make sure the ctaPanel is directly after the h2 header
    apiModal.after(ctaPanel);
});

/**
 * Helper function that converts an input field for a setting into a textarea.
 */
function convertSettingToTextarea(html, moduleId, settingKey, textareaStyle, repositionCallback) {
  const fullSettingId = `${moduleId}.${settingKey}`;
  console.log(`Divination | Converting setting to textarea: ${fullSettingId}`);
  
  // Use the data-setting-id attribute to find the setting div
  const settingDiv = html.find(`[data-setting-id="${fullSettingId}"]`);
  if (!settingDiv.length) {
    console.warn(`Divination | Setting div not found for ${fullSettingId}`);
    return;
  }
  
  // Get the original stored value from settings
  let storedValue = game.settings.get(moduleId, settingKey) || "";
  
  // Handle newlines - convert "\n" sequences to actual newlines
  storedValue = storedValue.replace(/\\n/g, "\n");
  
  // Find the original input
  const inputEl = settingDiv.find(`input[name="${fullSettingId}"]`);
  if (!inputEl.length) {
    console.warn(`Divination | Input element not found for ${fullSettingId}`);
    return;
  }

  // Create the textarea with proper attributes for code display
  const textarea = $(`
    <textarea name="${fullSettingId}"
              id="${fullSettingId}"
              style="font-family: monospace; white-space: pre; overflow-x: auto; ${textareaStyle}"
              wrap="off">${storedValue}</textarea>
  `);
  
  // Replace the input with our textarea
  inputEl.replaceWith(textarea);
  
  // When the textarea changes, properly escape newlines before saving
  textarea.on("change", async (ev) => {
    const rawValue = ev.target.value;
    // Convert actual newlines to "\n" sequence before saving
    const escaped = rawValue.replace(/\n/g, "\\n");
    await game.settings.set(moduleId, settingKey, escaped);
  });

  // Run the reposition callback if provided
  if (typeof repositionCallback === "function") {
    repositionCallback(settingDiv);
  }
}

// Handle settings UI rendering
Hooks.on("renderSettingsConfig", (app, html, data) => {
  console.log("Divination | Settings config rendered");
  
  // Wait a short moment to ensure DOM is fully rendered
  setTimeout(() => {
    try {
      // Convert the payloadJson setting field
      convertSettingToTextarea(
        html,
        "divination",
        "payloadJson",
        "width: 518px; min-height: 120px; height: 336px;",
        (settingDiv) => {
          // Reposition the form-fields div so that it appears after the <p class="notes"> element
          const notesEl = settingDiv.find("p.notes");
          const formFieldsEl = settingDiv.find("div.form-fields");
          if (notesEl.length && formFieldsEl.length) {
            notesEl.after(formFieldsEl);
          }
        }
      );
      
      // Convert the globalContext setting field
      convertSettingToTextarea(
        html,
        "divination",
        "globalContext",
        "width: 518px; min-height: 80px; height: 120px;",
        (settingDiv) => {
          // Reposition the form-fields div so that it appears after the <p class="notes"> element
          const notesEl = settingDiv.find("p.notes");
          const formFieldsEl = settingDiv.find("div.form-fields");
          if (notesEl.length && formFieldsEl.length) {
            notesEl.after(formFieldsEl);
          }
        }
      );
      
      // Add a click handler for tab switching to ensure textareas are converted
      html.find('a.item[data-tab="divination"]').on('click', () => {
        setTimeout(() => {
          const payloadInput = html.find('div[data-setting-id="divination.payloadJson"] input');
          if (payloadInput.length) {
            console.log("Divination | Found payloadJson input after tab click, converting");
            
            // Run conversion again if input is still there
            convertSettingToTextarea(
              html,
              "divination",
              "payloadJson",
              "width: 518px; min-height: 120px; height: 336px;",
              (settingDiv) => {
                const notesEl = settingDiv.find("p.notes");
                const formFieldsEl = settingDiv.find("div.form-fields");
                if (notesEl.length && formFieldsEl.length) {
                  notesEl.after(formFieldsEl);
                }
              }
            );
            
            convertSettingToTextarea(
              html,
              "divination",
              "globalContext",
              "width: 518px; min-height: 80px; height: 120px;",
              (settingDiv) => {
                const notesEl = settingDiv.find("p.notes");
                const formFieldsEl = settingDiv.find("div.form-fields");
                if (notesEl.length && formFieldsEl.length) {
                  notesEl.after(formFieldsEl);
                }
              }
            );
          }
        }, 100);
      });
    } catch (error) {
      console.error("Divination | Error in settings render:", error);
    }
  }, 100);
}); 