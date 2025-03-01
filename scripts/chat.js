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
    this.currentModelIndex = 0;
    this.processing = false;

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
    
    // Get available models from settings
    const models = game.settings.get('divination', 'models')
      .split(',')
      .map(m => m.trim())
      .filter(m => m);

    const modelName = models[0] || "AI Assistant";

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
   * Handle a user message
   * @param {string} message - The user's message
   * @private
   */
  async _handleUserMessage(message) {
    if (this.processing) {
      ui.notifications.warn("Please wait for the current response to complete.");
      return;
    }

    this.processing = true;
    
    try {
      // Get the assistant name and avatar from settings
      const assistantName = game.settings.get('divination', 'assistantName');
      const assistantAvatar = game.settings.get('divination', 'assistantAvatar');
      
      // Get the model to use
      const models = game.settings.get('divination', 'models')
        .split(',')
        .map(m => m.trim())
        .filter(m => m);
      
      const model = models[this.currentModelIndex] || models[0] || "";
      
      // Format user message with markdown parser
      const formattedUserMessage = MarkdownParser.parse(message);
      
      // ---------- CREATE NEW MESSAGES ARRAY ----------
      // This is the key change - we're rebuilding the entire messages array
      // to ensure the thinking message appears
      
      // 1. Save all existing messages
      const existingMessages = [...ChatModal.data.messages];
      
      // 2. Add user message to the array
      const userMessage = {
        _id: randomID(),
        content: formattedUserMessage,
        sender: game.user.name,
        img: game.user.avatar || "icons/svg/mystery-man.svg",
        cornerText: this._getTimestamp(),
        isCurrentUser: true
      };
      existingMessages.push(userMessage);
      
      // 3. Create thinking message
      const thinkingId = randomID();
      const thinkingMessage = {
        _id: thinkingId,
        content: "<p><i>Thinking...</i></p>",
        sender: assistantName,
        img: assistantAvatar,
        cornerText: this._getTimestamp(),
        isCurrentUser: false
      };
      
      // 4. First render with just the user's message
      ChatModal.data.messages = existingMessages;
      await this.chatWindow.render(true);
      
      // 5. Force DOM manipulation to add the thinking message directly
      setTimeout(() => {
        // Append thinking message to array
        existingMessages.push(thinkingMessage);
        ChatModal.data.messages = existingMessages;
        
        // Force a full rerender
        this.chatWindow.render(true);
        
        // Manually scroll to bottom after a short delay to ensure DOM is updated
        setTimeout(() => {
          const messageContainer = this.chatWindow.element.find('.chat-messages.message-list')[0];
          if (messageContainer) {
            messageContainer.scrollTop = messageContainer.scrollHeight;
          }
        }, 10);
      }, 50);
      
      // Wait a bit to ensure thinking message is rendered before API call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send to API
      const response = await sendMessage({
        message: message, // Send the plain message without HTML formatting
        history: this.history,
        model: model
      });
      
      // Update history
      this.history = response.history;
      
      // ---------- REPLACE MESSAGES ARRAY AGAIN ----------
      
      // 1. Get current messages and filter out the thinking message
      const finalMessages = ChatModal.data.messages.filter(m => m._id !== thinkingId);
      
      // 2. Add response message
      const responseMessage = {
        _id: randomID(),
        content: MarkdownParser.parse(response.content), // Parse the AI response as markdown
        sender: assistantName,
        img: assistantAvatar,
        cornerText: this._getTimestamp(),
        isCurrentUser: false
      };
      finalMessages.push(responseMessage);
      
      // 3. Replace messages array and render
      ChatModal.data.messages = finalMessages;
      await this.chatWindow.render(true);
      
      // Set up reasoning toggle listeners after rendering
      this._setupReasoningListeners();
      
      // Set up copy buttons for assistant messages
      this._setupCopyButtons();
    } catch (error) {
      log({
        message: "Error getting response",
        error: error,
        type: ["error"]
      });
      
      ui.notifications.error("Failed to get a response. Check the console for details.");
      
      // Add error message - don't filter existing messages, just add the error
      this.chatWindow.addMessage({
        content: "<p>Sorry, I encountered an error while processing your request. Please try again.</p>",
        sender: "System",
        cornerText: this._getTimestamp(),
        img: "icons/svg/hazard.svg"
      });
      
      await this.chatWindow.render(true);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Switch to the next available model
   */
  switchModel() {
    const models = game.settings.get('divination', 'models')
      .split(',')
      .map(m => m.trim())
      .filter(m => m);
    
    if (models.length <= 1) return;
    
    this.currentModelIndex = (this.currentModelIndex + 1) % models.length;
    const newModel = models[this.currentModelIndex];
    
    // Get assistant name and avatar
    const assistantName = game.settings.get('divination', 'assistantName');
    const assistantAvatar = game.settings.get('divination', 'assistantAvatar');
    
    this.chatWindow.addMessage({
      content: `<p>Switched to model: ${newModel}</p>`,
      sender: "System",
      cornerText: this._getTimestamp(),
      img: "icons/svg/upgrade.svg"
    });
  }
} 