import { log } from './utils.js';
import { sendMessage } from './api.js';
import { hasPermission } from './settings.js';
import { ChatModal, MarkdownParser } from './fimlib/main.js';
import { getChatModalClass } from './main.js';

/**
 * DivinationChat class - Extends FIMLib's ChatModal to create a specialized LLM chat interface
 */
export class DivinationChat {
  /**
   * The currently active chat instances
   * @type {Map<string, DivinationChat>}
   */
  static instances = new Map();

  /**
   * Create a new DivinationChat
   * @param {Object} options - Configuration options
   * @param {string} [options.title="Divination"] - The title of the chat window
   * @param {number} [options.width=400] - The width of the chat window
   * @param {number} [options.height=500] - The height of the chat window
   * @param {Array} [options.history=[]] - Initial message history
   * @param {string} [options.id=null] - Unique ID for this chat instance
   */
  constructor(options = {}) {
    this.options = mergeObject({
      title: "Divination",
      width: 400,
      height: 500,
      history: [],
      id: null
    }, options);

    this.history = this.options.history;
    this.id = this.options.id || randomID();
    this.processing = false;
    
    // Context items for the chat
    this.contextItems = [];

    // Get the appropriate ChatModal class (the extended version if available)
    const ModalClass = getChatModalClass();
    
    // Initialize the chat window using our custom modal class
    this.chatWindow = new ModalClass({
      title: this.options.title,
      width: this.options.width,
      height: this.options.height,
      showAvatars: true,
      showCornerText: true
    });

    // Display welcome message
    this._displayWelcomeMessage();

    // Register this instance
    DivinationChat.instances.set(this.id, this);

    // Override the chat window's _onSendMessage method to intercept messages
    const originalSendMethod = this.chatWindow._onSendMessage;
    this.chatWindow._onSendMessage = (html) => {
      const input = html.find('textarea.chat-input');
      const message = input.val().trim();
      
      if (message) {
        input.val('');
        this._handleUserMessage(message);
      }
    };
    
    // Add listener for reasoning toggle buttons
    this._setupReasoningListeners();
    
    // Set up the context items container
    this._setupContextContainer();
  }

  /**
   * Set up the context items container between conversation and input
   * @private
   */
  _setupContextContainer() {
    setTimeout(() => {
      // Just update the context items - the container already exists in the template
      this._updateContextItems();
    }, 100);
  }
  
  /**
   * Add a context item to the chat
   * @param {Object} contextItem - The context item to add
   * @param {string} contextItem.type - The type of context (journal, page, etc.)
   * @param {string} contextItem.id - The unique ID of the item
   * @param {string} contextItem.name - The name of the item
   * @param {string} contextItem.content - The text content
   */
  addContext(contextItem) {
    // Check if this context already exists (based on id and type)
    const existingIndex = this.contextItems.findIndex(item => 
      item.id === contextItem.id && item.type === contextItem.type
    );
    
    if (existingIndex !== -1) {
      // Replace existing context with updated one
      this.contextItems[existingIndex] = contextItem;
      ui.notifications.info(`Updated context: ${contextItem.name}`);
    } else {
      // Add new context
      this.contextItems.push(contextItem);
      ui.notifications.info(`Added context: ${contextItem.name}`);
    }
    
    // Update the UI
    this._updateContextItems();
  }
  
  /**
   * Remove a context item from the chat
   * @param {string} id - The ID of the item to remove
   * @param {string} type - The type of the item to remove
   */
  removeContext(id, type) {
    const initialLength = this.contextItems.length;
    this.contextItems = this.contextItems.filter(item => !(item.id === id && item.type === type));
    
    if (this.contextItems.length < initialLength) {
      // Update the UI if an item was removed
      this._updateContextItems();
      ui.notifications.info("Removed context item");
    }
  }
  
  /**
   * Update the context items in the UI
   * @private
   */
  _updateContextItems() {
    const contextItemsContainer = $(this.chatWindow.element).find('.auxiliary-content-container .divination-context-items');
    if (!contextItemsContainer.length) return;
    
    // Clear existing items
    contextItemsContainer.empty();
    
    // If there are no items, hide the container
    if (this.contextItems.length === 0) {
      $(this.chatWindow.element).find('.auxiliary-content-container').hide();
      return;
    }
    
    // Show the container
    $(this.chatWindow.element).find('.auxiliary-content-container').show();
    
    // Add each context item
    this.contextItems.forEach(item => {
      let icon, label;
      
      // Determine icon and label based on type
      if (item.type === 'journal') {
        icon = 'fa-book';
        label = `Journal: ${item.name}`;
      } else if (item.type === 'page') {
        icon = 'fa-scroll';
        label = `Page: ${item.name} (${item.journalName})`;
      } else {
        icon = 'fa-file-alt';
        label = item.name || 'Context';
      }
      
      // Create the context item element
      const contextItem = $(`
        <div class="divination-context-item" data-id="${item.id}" data-type="${item.type}">
          <i class="fas ${icon} divination-context-item-icon"></i>
          <span class="divination-context-item-label">${label}</span>
          <i class="fas fa-times divination-context-item-remove"></i>
        </div>
      `);
      
      // Add click handler for the remove button
      contextItem.find('.divination-context-item-remove').click(ev => {
        ev.preventDefault();
        ev.stopPropagation();
        this.removeContext(item.id, item.type);
      });
      
      // Add the item to the container
      contextItemsContainer.append(contextItem);
    });
  }

  /**
   * Get a formatted timestamp string for the current time
   * @returns {string} - Formatted timestamp
   * @private
   */
  _getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  /**
   * Initialize the Divination module
   */
  static init() {
    log({message: "Initializing Divination chat"});
    
    // Register the divination chat button in the sidebar
    Hooks.on('getSceneControlButtons', (controls) => {
      // Only add the button if the user has permission to use divination
      if (hasPermission(game.user)) {
        controls.push({
          name: 'divination',
          title: 'Divination',
          icon: 'fas fa-crystal-ball',
          button: true,
          onClick: () => DivinationChat.openChat()
        });
      }
    });
  }

  /**
   * Open a new chat window or bring an existing one to focus
   * @param {Object} options - Options to pass to the DivinationChat constructor
   * @returns {DivinationChat} - The chat instance
   */
  static openChat(options = {}) {
    // Check permission first
    if (!hasPermission(game.user)) {
      ui.notifications.error("You don't have permission to use Divination.");
      return null;
    }

    const id = options.id || 'default';

    // If we have an existing chat instance with this id
    if (DivinationChat.instances.has(id)) {
      const chat = DivinationChat.instances.get(id);
      
      // If the window is open, just focus it
      if (chat.chatWindow?.element?.is(":visible")) {
        chat.chatWindow.bringToTop();
        return chat;
      } else {
        // Window exists but is closed
        // Instead of deleting it, just rerender it to preserve history
        chat.render(true);
        return chat;
      }
    }

    // Create a new chat with either the provided id or 'default'
    const chat = new DivinationChat({...options, id});
    chat.render(true);
    return chat;
  }

  /**
   * Render the chat window
   * @param {boolean} [force=false] - Whether to force re-rendering
   */
  render(force = false) {
    this.chatWindow.render(true, {
      focus: true,
      height: this.options.height,
      width: this.options.width
    });
    
    // Re-setup reasoning listeners after re-render
    this._setupReasoningListeners();
    
    // Re-setup copy buttons after re-render
    this._setupCopyButtons();
    
    // Re-setup context container after re-render
    this._setupContextContainer();
  }

  /**
   * Close the chat window and clean up
   */
  close() {
    // Just close the window but don't delete from instances
    // This allows the window to be reopened later
    if (this.chatWindow) {
      this.chatWindow.close();
    }
  }

  /**
   * Display a welcome message in the chat
   * @private
   */
  _displayWelcomeMessage() {
    // Get assistant name from settings
    const assistantName = game.settings.get('divination', 'assistantName');
    const assistantAvatar = game.settings.get('divination', 'assistantAvatar');
    
    // Create greeting message
    const greetingMessage = `Greetings! I am ${assistantName}, and I will provide the answers you seek.`;
    
    // Add to visual chat and history only if the history is empty
    if (this.history.length === 0) {
      this.chatWindow.addMessage({
        content: `<p>${greetingMessage}</p>`,
        sender: assistantName,
        cornerText: this._getTimestamp(),
        img: assistantAvatar
      });
      
      // Add to conversation history for API context
      if (this.history && Array.isArray(this.history)) {
        this.history.push({
          role: 'assistant',
          content: greetingMessage
        });
      }
    }
    
    // Set up copy button for the welcome message
    this._setupCopyButtons();
  }

  /**
   * Set up event listeners for reasoning toggle buttons
   * @private
   */
  _setupReasoningListeners() {
    // Wait a short time for DOM to update
    setTimeout(() => {
      // Find all toggle buttons in this chat window
      $(this.chatWindow.element)
        .find('.divination-toggle-reasoning')
        .off('click')
        .on('click', (event) => {
          const reasoningBlock = $(event.currentTarget).closest('.divination-reasoning');
          const preview = reasoningBlock.find('.divination-reasoning-preview');
          const full = reasoningBlock.find('.divination-reasoning-full');
          
          // Toggle visibility
          if (preview.length) {
            preview.toggle();
          }
          full.toggle();
        });
    }, 100);
  }

  /**
   * Set up copy buttons for assistant messages
   * This adds a copy button to each assistant message
   * @private
   */
  _setupCopyButtons() {
    // Wait a short time for DOM to update
    setTimeout(() => {
      // Get the assistant name from settings
      const assistantName = game.settings.get('divination', 'assistantName');
      
      // Find all assistant messages in this chat window
      const assistantMessages = $(this.chatWindow.element)
        .find('.chat-message')
        .filter(function() {
          // Find messages where sender is the assistant
          return $(this).find('.message-sender .title').text() === assistantName;
        });
      
      // Process each message to add copy button if not already present
      assistantMessages.each((i, message) => {
        const $message = $(message);
        const messageId = $message.data('message-id');
        
        // Skip if this message already has a copy button
        if ($message.find('.divination-copy-btn').length) return;
        
        // Create a copy button
        const copyButton = $(`
          <button class="divination-copy-btn" title="Copy response to clipboard" data-message-id="${messageId}">
            <i class="fas fa-copy"></i>
          </button>
        `);
        
        // Create tooltip element
        const tooltip = $(`<div class="divination-copy-tooltip">Copied!</div>`);
        
        // Add the button to the message header's metadata section
        const metadataSection = $message.find('.message-metadata');
        metadataSection.append(copyButton);
        metadataSection.css('position', 'relative').append(tooltip);
        
        // Add click handler to copy message content
        copyButton.on('click', async (event) => {
          // Get the message content (excluding any potential reasoning section)
          let contentEl = $message.find('.message-content');
          
          // If there's a divination-response section, prefer that (excludes reasoning)
          const responseSection = contentEl.find('.divination-response');
          if (responseSection.length) {
            contentEl = responseSection;
          }
          
          try {
            // Try to copy both as formatted and plain text
            await this._copyMessageContent(contentEl[0], tooltip, copyButton);
          } catch (err) {
            console.error('Divination | Failed to copy text: ', err);
            ui.notifications.error("Failed to copy message to clipboard");
          }
          
          // Prevent event bubbling
          event.preventDefault();
          event.stopPropagation();
        });
      });
    }, 150);
  }
  
  /**
   * Copy message content to clipboard with proper formatting
   * @param {HTMLElement} contentElement - The element containing the message content
   * @param {jQuery} tooltip - The tooltip element to show feedback
   * @param {jQuery} button - The button element for visual feedback
   * @private
   */
  async _copyMessageContent(contentElement, tooltip, button) {
    if (!contentElement) return;
    
    try {
      // Get both HTML and plain text versions
      const htmlContent = contentElement.innerHTML;
      
      // Create a temporary element to get plain text with preserved formatting
      const temp = document.createElement('div');
      temp.innerHTML = htmlContent;
      
      // Process the element to convert some HTML to plain text equivalent
      this._processElementForTextCopy(temp);
      
      // Get the processed plain text
      const plainText = temp.innerText || temp.textContent || '';
      
      // Trim whitespace
      const trimmedText = plainText.trim();

      // Try to use the Clipboard API to copy both formats if available
      if (navigator.clipboard && navigator.clipboard.write) {
        // Create a clipboard item with both HTML and text formats
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
          'text/plain': new Blob([trimmedText], { type: 'text/plain' })
        });
        
        await navigator.clipboard.write([clipboardItem]);
      } else {
        // Fallback to basic text copying
        await navigator.clipboard.writeText(trimmedText);
      }
      
      // Show success feedback
      button.addClass('copied');
      tooltip.addClass('visible');
      
      // Reset after a delay
      setTimeout(() => {
        button.removeClass('copied');
        tooltip.removeClass('visible');
      }, 2000);
      
    } catch (err) {
      console.error('Divination | Copy operation failed:', err);
      throw err;
    }
  }
  
  /**
   * Process an element to convert HTML to plain text equivalents
   * @param {HTMLElement} element - The element to process
   * @private 
   */
  _processElementForTextCopy(element) {
    if (!element) return;
    
    // Process heading tags to add # symbols
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.substring(1));
      const prefix = '#'.repeat(level) + ' ';
      heading.prepend(prefix);
    });
    
    // Process code blocks to preserve formatting
    const codeBlocks = element.querySelectorAll('pre');
    codeBlocks.forEach(block => {
      block.style.whiteSpace = 'pre';
    });
    
    // Process list items to add bullets or numbers
    const lists = element.querySelectorAll('ul, ol');
    lists.forEach(list => {
      const isOrdered = list.tagName.toLowerCase() === 'ol';
      let counter = 1;
      
      Array.from(list.children).forEach(item => {
        if (isOrdered) {
          item.prepend(`${counter++}. `);
        } else {
          item.prepend('• ');
        }
      });
    });
    
    // Process blockquotes to add > prefix
    const blockquotes = element.querySelectorAll('blockquote');
    blockquotes.forEach(quote => {
      quote.prepend('> ');
    });
    
    // Make sure links show their URLs
    const links = element.querySelectorAll('a');
    links.forEach(link => {
      if (link.href && link.textContent && !link.textContent.includes(link.href)) {
        link.textContent += ` (${link.href})`;
      }
    });
    
    // Ensure proper line breaks
    const paragraphs = element.querySelectorAll('p');
    paragraphs.forEach(p => {
      if (p.nextElementSibling) {
        p.append(document.createTextNode('\n\n'));
      }
    });
  }

  /**
   * Format bot messages with markdown and special tokens
   * @param {string} message - The bot's message
   * @returns {string} - Formatted HTML
   * @private
   */
  _formatBotMessage(message) {
    if (!message) return '<p>No response received.</p>';
    
    try {
      // Check if message already has HTML tags
      const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(message);
      
      let formattedMessage;
      
      if (hasHtmlTags) {
        // If it already has HTML, just wrap in a div
        formattedMessage = `<div class="divination-response">${message}</div>`;
      } else {
        // Otherwise parse markdown
        formattedMessage = `<div class="divination-response">${MarkdownParser.parse(message)}</div>`;
      }
      
      return formattedMessage;
    } catch (error) {
      console.error("Divination | Error formatting message:", error);
      // Return raw message if formatting fails
      return `<div class="divination-response"><p>${message}</p></div>`;
    }
  }

  /**
   * Handle a user message and generate a response
   * @param {string} message - The user's message
   * @private
   */
  async _handleUserMessage(message) {
    try {
      if (this.processing) return;
      this.processing = true;
      
      // Get user info
      const userName = game.user.name;
      const userAvatar = game.user.avatar || 'icons/svg/mystery-man.svg';
      
      // Add user message to visual chat
      this.chatWindow.addMessage({
        content: `<p>${message}</p>`,
        sender: userName,
        cornerText: this._getTimestamp(),
        isCurrentUser: true,
        img: userAvatar
      });
      
      // Add to conversation history
      this.history.push({
        role: 'user',
        content: message
      });
      
      // Get assistant name
      const assistantName = game.settings.get('divination', 'assistantName');
      const assistantAvatar = game.settings.get('divination', 'assistantAvatar');
      
      // Prepare for thinking indicator
      let thinkingMessage = null;
      let thinkingTimeout = null;
      
      // Generate a random delay between 500-1000ms for thinking indicator
      const thinkingDelay = Math.floor(Math.random() * 501) + 500;
      
      // Set up timeout for showing thinking indicator
      thinkingTimeout = setTimeout(() => {
        // Show thinking indicator after delay
        thinkingMessage = this.chatWindow.addMessage({
          content: `<p><i>Thinking...</i></p>`,
          sender: assistantName,
          cornerText: this._getTimestamp(),
          img: assistantAvatar
        });
      }, thinkingDelay);
      
      // Generate response from API
      // Pass context items separately from history to keep them as reference material
      const response = await sendMessage({ 
        message: message,
        history: this.history,
        contextItems: this.contextItems 
      });
      
      // Clear timeout if response came back before thinking indicator was shown
      clearTimeout(thinkingTimeout);
      
      // Remove thinking indicator if it was shown
      if (thinkingMessage) {
        thinkingMessage.remove();
      }
      
      if (response.error) {
        // Show error in chat
        this.chatWindow.addMessage({
          content: `<p class="divination-error">Error: ${response.error}</p>`,
          sender: assistantName,
          cornerText: this._getTimestamp(),
          img: assistantAvatar
        });
        return;
      }
      
      // Get bot response - use proper property based on the returned response object
      let botMessage = "";
      
      // Check what format the response is in
      if (typeof response === 'string') {
        // Simple string response
        botMessage = response;
      } else if (response.response) {
        // Direct response property
        botMessage = response.response;
      } else if (response.content) {
        // Content property (from the API wrapper)
        botMessage = response.content;
      } else if (response.rawContent) {
        // Raw content property
        botMessage = response.rawContent;
      } else {
        // Fallback
        botMessage = "I'm sorry, I couldn't generate a response.";
      }
      
      // Add to conversation history
      this.history.push({
        role: 'assistant',
        content: botMessage
      });
      
      // Add formatted response to visual chat
      this.chatWindow.addMessage({
        content: this._formatBotMessage(botMessage),
        sender: assistantName,
        cornerText: this._getTimestamp(),
        img: assistantAvatar
      });
      
    } catch (error) {
      console.error("Divination | Error handling user message", error);
      ui.notifications.error("Error processing message. See console for details.");
    } finally {
      this.processing = false;
    }
  }
} 