# Divination

![Foundry v12](https://img.shields.io/badge/foundry-v12-green)
![Latest Release](https://img.shields.io/github/v/release/Daxiongmao87/divination-foundry?label=latest%20release)
![GitHub all releases](https://img.shields.io/github/downloads/Daxiongmao87/divination-foundry/total)

## Overview

Divination is a module for Foundry VTT that integrates AI language models directly into your virtual tabletop. It provides a ChatGPT-like interface that allows game masters and players to ask questions, brainstorm ideas, and get assistance during gameplay.

![Divination Screenshot](https://github.com/Daxiongmao87/divination-foundry/raw/main/assets/screenshot.png)

## Features

- 💬 **Interactive Chat Interface**: A sleek, dedicated chat window powered by FIMLib
- 🧠 **AI Integration**: Compatible with OpenAI, local LLMs, and more through flexible API configuration
- 📝 **Journal Integration**: Ask the AI about specific journal entries with one click
- 🌐 **Global Context**: Provide game-specific context that persists across all conversations
- 🛠️ **Customizable**: Configure the module to work with almost any LLM provider
- ✨ **Interactive UI**: Beautiful glowing crystal ball icons and intuitive interface

## Installation

### Method 1: From Foundry VTT Package Manager (Recommended)

1. In Foundry VTT, navigate to the "Add-on Modules" tab
2. Click "Install Module"
3. Search for "Divination"
4. Click "Install"

### Method 2: Manual Installation

1. Download the [latest release](https://github.com/Daxiongmao87/divination-foundry/releases/latest/download/module.zip)
2. Extract the zip file to your Foundry VTT `Data/modules` directory
3. Restart Foundry VTT and enable the module in your world

## Configuration

After installation, you'll need to configure the module with your LLM API settings:

1. Navigate to "Game Settings" > "Configure Settings" > "Module Settings"
2. Select "Divination" from the sidebar
3. Configure the following critical settings:
   - **Text Generation API URL**: URL for your LLM API endpoint
   - **API Key**: Your API key (if required)

Additional settings to customize your experience:
   - **Enable HTTPS**: Enable if using a remote API that requires HTTPS
   - **Response JSON Path**: Path to extract the response from API result
   - **Message History Length**: Number of messages to include in context
   - **Global Context**: Additional context to include in all conversations
   - **Permission Level**: Control who can use Divination

## API Configuration Examples

### OpenAI

- **Text Generation API URL**: `api.openai.com/v1/chat/completions`
- **API Key**: Your OpenAI API key
- **Response JSON Path**: `choices.0.message.content`

### Ollama (Local)

- **Text Generation API URL**: `localhost:11434/api/chat`
- **Enable HTTPS**: Disabled
- **Response JSON Path**: `message.content`

### Mistral Platform

- **Text Generation API URL**: `api.mistral.ai/v1/chat/completions`
- **API Key**: Your Mistral API key
- **Response JSON Path**: `choices.0.message.content`

## Usage

### Chat Interface

1. Click the glowing crystal ball icon in the sidebar or chat controls
2. Type your question or prompt in the chat interface
3. Press Enter or click the send button to receive AI-generated responses
4. Use the copy button to easily save important responses

### Journal Integration

1. Open any journal entry
2. Click the crystal ball icon in the journal header
3. Divination will automatically send the journal content to the AI
4. Receive insights, summaries, or explanations about the journal content

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests on [GitHub](https://github.com/Daxiongmao87/divination-foundry).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

- Created by [Daxiongmao87](https://github.com/Daxiongmao87)
- Uses [FIMLib](https://github.com/Daxiongmao87/fimlib-foundry) for the chat interface

## Support

If you have questions or need help, you can:
- Open an [issue on GitHub](https://github.com/Daxiongmao87/divination-foundry/issues)
- Reach out on Discord: Dax87
