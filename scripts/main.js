import { registerSettings, hasPermission } from './settings.js';
import { DivinationChat } from './chat.js';
import { log } from './utils.js';
import { ChatModal, TabManager, registerGlobals } from './fimlib/src/main.js';

// Global variable to store our extended ChatModal class
let DivinationChatModal = null;

// Function to get the correct ChatModal class
export function getChatModalClass() {
    return DivinationChatModal || ChatModal;
}

// Initialize module
Hooks.once('init', async () => {
    try {
        log({message: "Initializing Divination module"});
        
        // Safety check for game object
        if (typeof game === 'undefined') {
            console.error("Divination | Game object not available during init");
            return;
        }
        
        // Register module settings
        registerSettings();
        
        // Register FIMLib components under the Divination namespace
        registerGlobals('Divination');
        
        // Extend the ChatModal class with our own version that has the correct template path
        DivinationChatModal = class extends ChatModal {
            static get defaultOptions() {
                const options = super.defaultOptions;
                options.template = "modules/divination/scripts/fimlib/src/templates/chat-modal.html";
                return options;
            }
        };
        
        // Replace the original ChatModal with our extended version
        window.Divination.FIMLib.ChatModal = DivinationChatModal;
        
        log({message: "Divination module initialized"});
    } catch (error) {
        console.error("Divination | Error during initialization", error);
    }
});

// Set up when Foundry is ready
Hooks.once('ready', async () => {
    try {
        log({message: "Divination module ready"});
        
        // Safety check for game object
        if (typeof game === 'undefined') {
            console.error("Divination | Game object not available during ready hook");
            return;
        }
        
        // Initialize the DivinationChat
        try {
            DivinationChat.init();
        } catch (chatError) {
            console.error("Divination | Failed to initialize chat", chatError);
        }
        
        // Create global reference for API consumption
        window.Divination = window.Divination || {};
        Object.assign(window.Divination, {
            openChat: DivinationChat.openChat,
            instances: DivinationChat.instances,
            getChatModalClass
        });
        
        log({message: "Divination module initialized successfully"});
    } catch (error) {
        console.error("Divination | Error during ready hook", error);
    }
});

// Add a Divination button to the chat controls
Hooks.on('renderChatLog', (app, html, data) => {
    if (!hasPermission(game.user)) return;
    
    const isConfigured = checkRequiredSettings();
    
    // Create the button that matches the styling of other chat control icons
    const divinationButton = $(`
        <label class="chat-control-icon divination-chat-control${isConfigured ? '' : ' disabled'}" 
               data-tooltip="${isConfigured ? 'Open Divination' : 'Configure Divination settings to enable'}">
            <i class="fas fa-crystal-ball"></i>
        </label>
    `);
    
    // Add the click event to open the Divination chat
    divinationButton.click(ev => {
        ev.preventDefault();
        if (isConfigured) {
            DivinationChat.openChat();
        } else {
            ui.notifications.warn("Please configure Divination settings first.");
        }
    });
    
    // Add the button as the first child in the control-buttons div
    const controlButtons = html.find('.control-buttons');
    controlButtons.prepend(divinationButton);
});

// Add divination button to the sidebar menu
Hooks.on('getSceneControlButtons', (controls) => {
    if (!hasPermission(game.user)) return;
    
    const isConfigured = checkRequiredSettings();
    
    // Find the basic controls group or create a new group
    let tokenTools = controls.find(c => c.name === "token") || 
                    controls.find(c => c.name === "basic") || 
                    null;
    
    if (!tokenTools) {
        // Add our controls as a new group
        controls.push({
            name: "divination",
            title: "Divination",
            icon: "fas fa-crystal-ball",
            layer: "controls",
            tools: [{
                name: "chat",
                title: isConfigured ? "Open Divination Chat" : "Configure Divination settings to enable",
                icon: "fas fa-crystal-ball",
                button: true,
                onClick: () => {
                    if (isConfigured) {
                        DivinationChat.openChat();
                    } else {
                        ui.notifications.warn("Please configure Divination settings first.");
                    }
                }
            }]
        });
    } else {
        // Add our tool to an existing group
        tokenTools.tools.push({
            name: "divination",
            title: isConfigured ? "Open Divination Chat" : "Configure Divination settings to enable",
            icon: "fas fa-crystal-ball",
            button: true,
            onClick: () => {
                if (isConfigured) {
                    DivinationChat.openChat();
                } else {
                    ui.notifications.warn("Please configure Divination settings first.");
                }
            }
        });
    }
});

// Listen for individual setting changes and update buttons immediately
Hooks.on('updateSetting', (setting) => {
    if (setting.key.startsWith('divination.')) {
        log({message: `Divination setting updated: ${setting.key}`, type: ["debug"]});
        updateDivinationUI();
    }
});

// Also listen for the entire settings form closing
Hooks.on('closeSettingsConfig', () => {
    log({message: "Settings form closed, updating Divination UI", type: ["debug"]});
    updateDivinationUI();
});

/**
 * Updates all UI elements that depend on Divination settings
 */
function updateDivinationUI() {
    // Check if settings are now configured properly
    const isConfigured = checkRequiredSettings();
    
    // Force UI updates with a small delay to ensure settings are applied
    setTimeout(() => {
        try {
            // Re-render UI elements to update button states
            if (ui.controls) ui.controls.render();
            
            // Re-render the chat log to update chat controls
            if (ui.chat) {
                ui.chat.render();
                
                // Force immediate re-render of chat controls
                if (ui.chat._element && ui.chat._element.length) {
                    const chatControls = ui.chat._element.find('#chat-controls');
                    if (chatControls.length) {
                        // Remove existing Divination buttons and re-add them
                        chatControls.find('.divination-chat-control').remove();
                        
                        // Trigger the renderChatLog hook which will add our button
                        Hooks.callAll('renderChatLog', ui.chat, chatControls, {});
                    }
                }
            }
            
            // Update any open journal sheets to refresh their header buttons
            Object.values(ui.windows).forEach(app => {
                if (app.constructor.name === "JournalSheet") {
                    app.render();
                }
            });
            
            // Notify the user if Divination is now ready
            if (isConfigured) {
                ui.notifications.info("Divination is now ready to use!");
            }
            
            log({message: "Divination UI elements refreshed", type: ["debug"]});
        } catch (error) {
            console.error("Divination | Error updating UI elements", error);
        }
    }, 100);
}

// Add a button to journal sheet header
Hooks.on('getJournalSheetHeaderButtons', (app, buttons) => {
    // Get the current journal entry
    const journalEntry = app.object;
    
    const isConfigured = checkRequiredSettings();
    
    // Only add button if user has permission
    if (hasPermission(game.user)) {
        buttons.unshift({
            label: "Ask about this entry",
            icon: "fas fa-crystal-ball",
            onclick: () => {
                if (!isConfigured) {
                    ui.notifications.warn("Please configure Divination settings first.");
                    return;
                }
                
                // Get journal entry content - v12 uses document instead of data
                const content = journalEntry.pages?.contents?.[0]?.text?.content || 
                               journalEntry.content || 
                               journalEntry.data?.content || 
                               "";
                
                const title = journalEntry.name || 
                             journalEntry.data?.name || 
                             "Untitled Entry";
                
                // Clean HTML tags to get plain text
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = content;
                const plainText = tempDiv.textContent || tempDiv.innerText || "";
                
                // Open Divination chat with prefilled question about the journal
                const chat = DivinationChat.openChat();
                if (!chat) return; // User might not have permission
                
                const message = `Could you help me understand this journal entry titled "${title}"? Here's the content:\n\n${plainText.substring(0, 1500)}${plainText.length > 1500 ? '...' : ''}`;
                
                // Add message without sending
                chat.chatWindow.addMessage({
                    content: message,
                    sender: game.user.name,
                    img: game.user.avatar || "icons/svg/mystery-man.svg",
                    cornerText: chat._getTimestamp()
                });
                
                // Send the message
                chat._handleUserMessage(message);
            }
        });
    }
});

/**
 * Checks if the required settings are configured for Divination to function
 * @returns {boolean} - Whether the module is properly configured
 */
function checkRequiredSettings() {
    try {
        // Check if API URL is set and not empty
        const apiUrl = game.settings.get('divination', 'textGenerationApiUrl');
        if (!apiUrl || apiUrl === "") {
            log({message: "API URL not configured", type: ["debug"]});
            return false;
        }

        // If using default OpenAI URL, check for API key
        if (apiUrl === "api.openai.com/v1/chat/completions") {
            const apiKey = game.settings.get('divination', 'apiKey');
            if (!apiKey) {
                log({message: "OpenAI API key required but not provided", type: ["debug"]});
                return false;
            }
        }
        
        log({message: "Divination properly configured", type: ["debug"]});
        return true;
    } catch (e) {
        console.error("Divination | Error checking settings", e);
        return false;
    }
} 