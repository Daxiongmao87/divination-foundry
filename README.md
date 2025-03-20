# Divination

![Foundry v12](https://img.shields.io/badge/foundry-v12-green)
![Latest Release](https://img.shields.io/github/v/release/Daxiongmao87/divination-foundry?label=latest%20release)
![GitHub all releases](https://img.shields.io/github/downloads/Daxiongmao87/divination-foundry/total)

[<img src="https://img.shields.io/badge/Support%20My%20Work-Buy%20me%20a%20coffee%20%E2%98%95-chocolate?style=plastic">](https://www.buymeacoffee.com/daxiongmao87)

## Overview

Divination is a Foundry VTT module that connects your tabletop games to AI language models. It provides a chat interface that lets Game Masters and players get instant AI assistance during gameplay.

![Divination Screenshot](https://github.com/Daxiongmao87/divination-foundry/raw/main/assets/screenshot.png)

## Features

- 🧙 **AI Integration**: Connect to OpenAI, Anthropic, or run local AI models
- 💬 **Chat Interface**: A dedicated window for interacting with AI assistants
- 📋 **Copy Function**: One-click copying of AI responses to clipboard
- 📚 **Journal Context**: Add journal entries and pages as context for more relevant AI responses

## Installation

### Method 1: Foundry VTT Package Manager (Recommended)

1. In your Foundry VTT setup, go to the "Add-on Modules" tab
2. Click "Install Module"
3. Search for "Divination"
4. Click "Install"

### Method 2: Manual Installation

1. Download the [latest release](https://github.com/Daxiongmao87/divination-foundry/releases/latest/download/module.zip)
2. Extract the zip file to your Foundry VTT `Data/modules` directory
3. Restart Foundry VTT
4. Enable the module in your world's module settings

## Configuration

After installation, configure the module with your AI service settings:

1. Go to "Game Settings" > "Configure Settings" > "Module Settings"
2. Select "Divination" from the sidebar
3. Configure these essential settings:
   - **Text Generation API URL**: Complete URL for your AI service endpoint (include https:// or http://)
   - **API Key**: Your API key (required for most services)
   - **System Prompt**: The instructions that define the AI's behavior

## Usage

### Using the Chat

1. Click the crystal ball icon in the sidebar or chat controls
2. Type your question in the chat interface
3. Press Enter to receive an AI response
4. Use the copy button to save important information

### Adding Journal Context

Divination allows you to add journal entries and pages as context for more informed AI responses:

1. **Adding a Journal Entry**: 
   - Open any journal entry
   - Click the crystal ball icon in the journal header
   - The entire journal content will be added as context to your Divination chat

2. **Adding a Journal Page**:
   - Open a journal entry with multiple pages
   - Hover over a page in the sidebar
   - Click the crystal ball icon that appears next to the page
   - Only that specific page will be added as context

3. **Using Context**:
   - Added context appears between the chat history and input field
   - You can add multiple journal entries and pages
   - Each context item can be removed by clicking its X icon
   - The AI will use this information when generating responses

This feature is particularly useful for lore questions, NPC interactions, or rules clarifications based on your notes.

## API Configuration Examples

Each AI service requires specific configuration. Here are examples for popular services:

### OpenAI

- **Text Generation API URL**: `https://api.openai.com/v1/chat/completions`
- **API Key**: Your OpenAI API key
- **Response JSON Path**: `choices.0.message.content`
- **Payload JSON Template**:
  ```json
  {
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": "{{SystemMessage}}"
      },
      {
        "role": "user",
        "content": "{{UserMessage}}"
      }
    ]
  }
  ```

### Anthropic (Claude)

- **Text Generation API URL**: `https://api.anthropic.com/v1/messages`
- **API Key**: Your Anthropic API key
- **API Key Header**: Use `x-api-key` in headers (not Bearer token)
- **Response JSON Path**: `content.0.text`
- **Payload JSON Template**:
  ```json
  {
    "model": "claude-3-opus-20240229",
    "messages": [
      {
        "role": "system",
        "content": "{{SystemMessage}}"
      },
      {
        "role": "user",
        "content": "{{UserMessage}}"
      }
    ],
    "max_tokens": 1024
  }
  ```

> **Note for older Claude versions**: If using an older Claude version that doesn't support system messages, use this template instead:
> ```json
> {
>   "model": "claude-2",
>   "messages": [
>     {
>       "role": "user",
>       "content": "{{SystemMessage}}\n\n{{UserMessage}}"
>     }
>   ],
>   "max_tokens": 1024
> }
> ```

### Ollama (Local LLM)

- **Text Generation API URL**: `http://localhost:11434/api/chat`
- **Response JSON Path**: `message.content`
- **Payload JSON Template**:
  ```json
  {
    "model": "llama3",
    "messages": [
      {
        "role": "system",
        "content": "{{SystemMessage}}"
      },
      {
        "role": "user",
        "content": "{{UserMessage}}"
      }
    ],
    "stream": false
  }
  ```

### Mistral AI

- **Text Generation API URL**: `https://api.mistral.ai/v1/chat/completions`
- **API Key**: Your Mistral API key
- **Response JSON Path**: `choices.0.message.content`
- **Payload JSON Template**:
  ```json
  {
    "model": "mistral-large-latest",
    "messages": [
      {
        "role": "system",
        "content": "{{SystemMessage}}"
      },
      {
        "role": "user",
        "content": "{{UserMessage}}"
      }
    ],
    "temperature": 0.7
  }
  ```

### LM Studio (Local)

- **Text Generation API URL**: `http://localhost:1234/v1/chat/completions`
- **Response JSON Path**: `choices.0.message.content`
- **Payload JSON Template**:
  ```json
  {
    "model": "default", 
    "messages": [
      {
        "role": "system",
        "content": "{{SystemMessage}}"
      },
      {
        "role": "user",
        "content": "{{UserMessage}}"
      }
    ],
    "temperature": 0.7,
    "stream": false
  }
  ```

## Credits

- Created by [Daxiongmao87](https://github.com/Daxiongmao87)
- Uses FIMLib for the chat interface

## Support

If you have questions or need assistance:
- Open an [issue on GitHub](https://github.com/Daxiongmao87/divination-foundry/issues)
- Contact me on Discord: Dax87
