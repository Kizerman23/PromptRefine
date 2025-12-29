# AI Prompt Enhancer (PromptCowboy Edition)

A premium browser extension (Chrome, Brave, Edge) that enhances your AI prompts in real-time using the **PromptCowboy.ai** API. Optimized for speed, smoothness, and reliability across all major AI platforms.

> [!IMPORTANT]
> **New to the extension?** Check out the [Installation & Usage Guide](./INSTALL_GUIDE.md) for a quick start.

## Key Features

- **Real-Time Streaming**: Watch your enhanced prompt appear word-by-word with a smooth "typing" effect.
- **3-Way Mode Toggle**:
  - **Auto**: Enhance and send immediately for maximum speed.
  - **Manual**: Review the enhancement, with an option to **Undo** if needed.
  - **Off**: Temporarily disable the extension for the current site/model without uninstalling.
- **Extreme ChatGPT Optimization**: Uses incremental typing ($O(N)$ logic) to eliminate lag even with very long prompts.
- **Precision Revert (Undo)**: Instantly restore your original text if the enhancement isn't what you wanted.
- **Smart Site-Specific Control**: Easily toggle the extension ON or OFF for specific models directly from the UI, or use native browser **Site Access** settings for advanced permission management.
- **Auth Detection**: Built-in alerts if you're logged out of PromptCowboy.ai.
- **Premium Glassmorphism UI**: A sleek, modern control panel that blends into any AI interface.

## 🛠 Project Structure

- `manifest.json`: Extension configuration, permissions, and script declarations.
- `src/`:
  - `background.js`: Handles API communication with PromptCowboy.ai.
  - `content.js`: Manages the UI, user interaction, and text injection.
- `assets/icons/`: Extension assets and logos.
- `INSTALL_GUIDE.md`: Step-by-step instructions for users.

## ⚡ Technical Highlights

### 1. Incremental Injection ($O(N)$)
Unlike standard extensions that replace the entire text on every update (causing $O(N^2)$ slowdown), this extension only appends the new characters. This ensures a constant, lag-free experience on complex editors like Lexical.

### 2. Port-Based Streaming
Uses `chrome.runtime.Port` for a persistent, low-latency connection between the background script and the webpage, allowing for real-time data flow.

### 3. Native Value Setters
Bypasses React/framework-level "guards" to ensure that the site's state is correctly updated during text injection and "Undo" actions, specifically fixing state sync issues in NotebookLM.

## 📦 Installation (Developer Mode)

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **"Developer mode"** (top right toggle).
4. Click **"Load unpacked"** and select the project folder.
5. **Important**: Login to [PromptCowboy.ai](https://www.promptcowboy.ai/login) to enable the enhancement features.

## ⚙️ Development & Testing

- **Testing**: Use the floating control panel to switch between modes.
- **Logs**: Open the browser console (F12) on any AI site to see the "Cowboy" logs.
- **Reverts**: In "Manual" mode, click the ↩ button to restore the original prompt.

