<div align="center">
  <h1>Gemini Limit Checker</h1>
  <p>A lightweight Chrome extension to display your Gemini usage limits directly in the chat UI.</p>
</div>

## ✨ Features

- **Real-time Indicator**: Displays your current Gemini usage limit percentage and reset time right on the screen.
- **Detailed Popover Panel**: Click or hover over the indicator to reveal an interactive card showing:
  - Current limit with a visual progress bar and exact reset time.
  - Weekly usage limit with progress bar and reset date/time.
  - Quick refresh button (🔄) and direct link to Gemini's full Usage page.
- **Responsive Design**: Automatically relocates the indicator to the top bar on smaller screens so it never gets in your way.
- **Auto-Update**: The usage limit fetches new data in the background and updates seamlessly.

> [!WARNING]
> **Important Note on Auto-Update Trigger:**
> This extension is specifically configured to update its data when you send a message using **`Ctrl + Enter`** (or `Cmd + Enter` on Mac). It **does not** trigger an update on a regular `Enter` key press. It will also update when you manually click the Send button, automatically every 3 minutes, or by clicking the indicator badge directly.

## 📦 Installation

Since this extension is not published on the Chrome Web Store, you can install it manually using Developer Mode:

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top right corner.
4. Click on **Load unpacked** in the top left corner.
5. Select the folder containing this repository.
6. Open or refresh [Gemini](https://gemini.google.com/) and you'll see the usage limit indicator!

## ⚠️ Disclaimer

- This is an unofficial extension and is not affiliated with Google.
- The extension relies on the current DOM structure of Gemini. Future updates by Google may break the functionality.
- This extension runs entirely locally and does not collect, store, or send any personal data or API keys.

## 📄 License

This project is licensed under the MIT License.
