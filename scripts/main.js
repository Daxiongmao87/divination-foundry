import { registerSettings, hasPermission } from './settings.js';
import { DivinationChat } from './chat.js';
import { log } from './utils.js';
import { ChatModal, TabManager, registerGlobals } from './fimlib/main.js';

// Global variable to store our extended ChatModal class
let DivinationChatModal = null;

/**
 * Returns the correct ChatModal class for Divination
 * @returns {Class} - The ChatModal class to use
 */
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
                options.template = "modules/divination/scripts/fimlib/templates/chat-modal.html";
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

/**
 * Adds Divination buttons to journal sheet headers
 * One button for adding the entire journal as context
 * One button for adding the current page as context
 */
Hooks.on('renderJournalSheet', (app, html, data) => {
    if (!hasPermission(game.user)) return;
    
    const isConfigured = checkRequiredSettings();
    if (!isConfigured) return;
    
    // Get the journal entry
    const journal = app.document;
    if (!journal) return;
    
    // Create button for adding entire journal as context
    const journalButton = $(`
        <a class="action-button divination-journal-all" data-tooltip="Add entire journal to Divination context">
            <i class="fas fa-crystal-ball"></i>
        </a>
    `);
    
    // Add click event to journal button
    journalButton.click(async ev => {
        ev.preventDefault();
        ev.stopPropagation();
        
        // Open or focus the chat
        const chat = DivinationChat.openChat();
        if (!chat) return;
        
        // Extract content from all pages
        const journalContext = {
            type: 'journal',
            id: journal.id,
            name: journal.name,
            content: await getJournalContent(journal, 'all')
        };
        
        // Add context to the chat
        chat.addContext(journalContext);
    });
    
    // Find the header-search flexrow div
    const headerSearchDiv = html.find('.header-search.flexrow');
    
    // Insert the journal button after the view-mode button
    if (headerSearchDiv.length) {
        // Find the view-mode button
        const viewModeButton = headerSearchDiv.find('.action-button.view-mode');
        if (viewModeButton.length) {
            viewModeButton.after(journalButton);
        } else {
            // If view-mode button not found, just prepend to the header-search div
            headerSearchDiv.prepend(journalButton);
        }
    }
    
    // Add button to individual page items in the sidebar using multiple methods
    
    // METHOD 1: Direct append to existing elements
    const addPageButtonsToSidebar = () => {
        // Find all page items in the sidebar
        const pageItems = html.find('.directory-item');
        
        // Process each page item
        pageItems.each((i, item) => {
            const pageItem = $(item);
            
            // Get the page ID - try multiple methods
            let pageId = pageItem.data('page-id');
            
            // If page ID not found via data attribute, try to find it via a different method
            if (!pageId) {
                // Try getting it from the data-document-id attribute (which some versions of Foundry might use)
                pageId = pageItem.data('document-id') || pageItem.attr('data-page-id') || pageItem.attr('data-document-id');
                
                // If still no page ID, try to get it from a child element
                if (!pageId) {
                    // Sometimes the ID is on an inner element
                    const idElement = pageItem.find('[data-page-id], [data-document-id]').first();
                    if (idElement.length) {
                        pageId = idElement.data('page-id') || idElement.data('document-id');
                    }
                }
            }
            
            // Skip if already has a button or no page ID
            if (!pageId || pageItem.find('.divination-page-button').length) return;
            
            // Create the page button
            const pageButton = $(`
                <a class="divination-page-button" data-tooltip="Add page to Divination context">
                    <i class="fas fa-scroll"></i>
                </a>
            `);
            
            // Add click handler
            pageButton.click(async ev => {
                ev.preventDefault();
                ev.stopPropagation();
                
                // Open or focus the chat
                const chat = DivinationChat.openChat();
                if (!chat) return;
                
                try {
                    // Get the page
                    const page = journal.pages.get(pageId);
                    if (!page) {
                        ui.notifications.warn(`Could not find the page with ID: ${pageId}`);
                        return;
                    }
                    
                    // Extract content from the page
                    const pageContext = {
                        type: 'page',
                        id: page.id,
                        name: page.name,
                        journalName: journal.name,
                        content: await getJournalContent(journal, pageId)
                    };
                    
                    // Add context to the chat
                    chat.addContext(pageContext);
                    
                    // Show success notification
                    ui.notifications.info(`Added page "${page.name}" to Divination context`);
                } catch (error) {
                    console.error("Divination | Error adding page context:", error);
                    ui.notifications.error("Failed to add page to context. See console for details.");
                }
            });
            
            // Try to find the best place to append the button
            const pageHeading = pageItem.find('.page-heading');
            
            if (pageHeading.length) {
                // If we have a page heading, append to it
                pageHeading.append(pageButton);
            } else {
                // Otherwise try to append to the directory item itself with absolute positioning
                pageItem.css('position', 'relative');
                pageItem.append(pageButton);
                pageButton.css({
                    'position': 'absolute',
                    'right': '5px',
                    'top': '50%',
                    'transform': 'translateY(-50%)'
                });
            }
            
            // Add a debug attribute to help troubleshoot
            pageButton.attr('data-page-id-ref', pageId);
        });
    };
    
    // METHOD 2: Add buttons via event delegation
    // This adds the buttons with jQuery event delegation which handles dynamic content better
    
    // Create the container for our delegated approach
    const directoryList = html.find('.directory-list');
    if (directoryList.length) {
        // Create a hidden template for the button that will be used
        const buttonTemplate = $(`
            <template id="divination-page-button-template">
                <a class="divination-page-button" data-tooltip="Add page to Divination context">
                    <i class="fas fa-scroll"></i>
                </a>
            </template>
        `);
        html.append(buttonTemplate);
        
        // Add the delegate listener
        directoryList.on('mouseenter', '.directory-item', function(event) {
            const item = $(this);
            
            // Skip if already has a button
            if (item.find('.divination-page-button').length) return;
            
            // Get page ID using various methods
            let pageId = item.data('page-id') || item.data('document-id') || 
                       item.attr('data-page-id') || item.attr('data-document-id');
            
            // If no ID found directly, check children
            if (!pageId) {
                const idElement = item.find('[data-page-id], [data-document-id]').first();
                if (idElement.length) {
                    pageId = idElement.data('page-id') || idElement.data('document-id');
                }
            }
            
            if (!pageId) return;
            
            // Clone the button from template
            const template = document.getElementById('divination-page-button-template');
            if (!template) return;
            
            const button = $(template.content.cloneNode(true).querySelector('.divination-page-button'));
            
            // Add the page ID reference
            button.attr('data-page-id-ref', pageId);
            
            // Add to heading or item itself
            const pageHeading = item.find('.page-heading');
            if (pageHeading.length) {
                pageHeading.append(button);
            } else {
                item.append(button);
            }
        });
        
        // Add the click handler using delegation
        directoryList.on('click', '.divination-page-button', async function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            const button = $(this);
            const pageId = button.attr('data-page-id-ref');
            
            if (!pageId) {
                ui.notifications.warn("No page ID found for this button.");
                return;
            }
            
            // Open or focus the chat
            const chat = DivinationChat.openChat();
            if (!chat) return;
            
            try {
                // Get the page
                const page = journal.pages.get(pageId);
                if (!page) {
                    ui.notifications.warn(`Could not find the page with ID: ${pageId}`);
                    return;
                }
                
                // Extract content from the page
                const pageContext = {
                    type: 'page',
                    id: page.id,
                    name: page.name,
                    journalName: journal.name,
                    content: await getJournalContent(journal, pageId)
                };
                
                // Add context to the chat
                chat.addContext(pageContext);
                
                // Show success notification
                ui.notifications.info(`Added page "${page.name}" to Divination context`);
            } catch (error) {
                console.error("Divination | Error adding page context:", error);
                ui.notifications.error("Failed to add page to context. See console for details.");
            }
        });
    }
    
    // Create a direct approach function for individual page items 
    // that targets the exact structure from the user's example
    const addButtonsToPages = () => {
        // Specifically find directory items with the class structure the user provided
        const pageItems = html.find('li.directory-item');
        
        pageItems.each((i, item) => {
            const pageItem = $(item);
            
            // Skip if already has a button
            if (pageItem.find('.divination-page-button').length) return;
            
            // Get page ID - specifically look at the data-page-id attribute described by the user
            const pageId = pageItem.attr('data-page-id');
            if (!pageId) return;
            
            // Create the button (simpler structure)
            const pageButton = $(`
                <a class="divination-page-button" data-tooltip="Add page to Divination">
                    <i class="fas fa-scroll"></i>
                </a>
            `);
            
            // Add click handler
            pageButton.click(async function(event) {
                event.preventDefault();
                event.stopPropagation();
                
                // Open or focus the chat
                const chat = DivinationChat.openChat();
                if (!chat) return;
                
                try {
                    // Get the page
                    const page = journal.pages.get(pageId);
                    if (!page) {
                        ui.notifications.warn(`Could not find the page with ID: ${pageId}`);
                        return;
                    }
                    
                    // Extract content from the page
                    const pageContext = {
                        type: 'page',
                        id: page.id,
                        name: page.name,
                        journalName: journal.name,
                        content: await getJournalContent(journal, pageId)
                    };
                    
                    // Add context to the chat
                    chat.addContext(pageContext);
                    
                    // Show success notification
                    ui.notifications.info(`Added page "${page.name}" to Divination context`);
                } catch (error) {
                    console.error("Divination | Error adding page context:", error);
                    ui.notifications.error("Failed to add page to context. See console for details.");
                }
            });
            
            // Append directly to the list item as per user's example
            pageItem.append(pageButton);
        });
    };
    
    // Try all approaches for maximum compatibility
    addPageButtonsToSidebar();
    // Try the direct DOM approach based on the user's HTML
    addButtonsToPages();
    
    // Add CSS for the buttons
    const style = $(`
        <style>
            /* Journal button in header */
            .divination-journal-all {
                margin-right: 4px;
            }
            
            /* Page buttons in sidebar */
            .directory-item .page-heading {
                position: relative;
            }
            
            .divination-page-button {
                position: absolute;
                right: 30px;
                top: 50%;
                transform: translateY(-50%);
                color: #666;
                opacity: 0.7;
                font-size: 12px;
                transition: all 0.2s ease;
                z-index: 100;
                background: rgba(255, 255, 255, 0.7);
                padding: 2px 5px;
                border-radius: 3px;
            }
            
            .divination-page-button:hover {
                color: #000;
                opacity: 1;
                background: rgba(255, 255, 255, 0.9);
            }
            
            /* Make sure buttons are visible on hover */
            .directory-item .divination-page-button {
                display: none !important;
            }
            
            .directory-item:hover .divination-page-button {
                display: inline-flex !important;
                align-items: center;
                justify-content: center;
            }
            
            /* Add some margin after the icon */
            .divination-page-button i {
                margin-right: 4px;
            }
        </style>
    `);
    html.append(style);
});

/**
 * Extract content from a journal or specific page
 * @param {JournalEntry} journal - The journal entry
 * @param {string} pageId - The page ID or 'all' for all pages
 * @returns {string} - The extracted content
 */
async function getJournalContent(journal, pageId) {
    try {
        if (pageId === 'all') {
            // Extract content from all pages
            const allContent = [];
            for (const page of journal.pages) {
                const content = await extractPageContent(page);
                if (content) {
                    allContent.push(`## ${page.name}\n\n${content}`);
                }
            }
            return allContent.join('\n\n');
        } else {
            // Extract content from specific page
            const page = journal.pages.get(pageId);
            if (!page) return '';
            return await extractPageContent(page);
        }
    } catch (error) {
        console.error("Divination | Error extracting journal content", error);
        return '';
    }
}

/**
 * Extract content from a journal page
 * @param {JournalEntryPage} page - The journal page
 * @returns {string} - The extracted content
 */
async function extractPageContent(page) {
    try {
        if (page.text && page.text.content) {
            // Handle text content
            let content = page.text.content;
            
            // Remove HTML tags and convert to plain text
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            content = tempDiv.textContent || tempDiv.innerText || '';
            
            return content.trim();
        } else if (page.type === 'image') {
            // For image pages, just return the caption or a placeholder
            return page.image?.caption || `[Image: ${page.name}]`;
        } else if (page.type === 'pdf') {
            // For PDF pages, just return a placeholder
            return `[PDF Document: ${page.name}]`;
        }
        
        return '';
    } catch (error) {
        console.error("Divination | Error extracting page content", error);
        return '';
    }
}

/**
 * Adds a Divination button to the chat controls
 */
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

/**
 * Adds Divination button to the sidebar menu
 */
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

/**
 * Listen for individual setting changes and update buttons immediately
 */
Hooks.on('updateSetting', (setting) => {
    if (setting.key.startsWith('divination.')) {
        log({message: `Divination setting updated: ${setting.key}`, type: ["debug"]});
        updateDivinationUI();
    }
});

/**
 * Listen for the entire settings form closing
 */
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