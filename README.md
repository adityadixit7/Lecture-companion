# UPSC Lecture Companion

A lightweight Chrome extension for UPSC lecture revision. It captures the active lecture slide, summarizes it with an AI model, lets you edit and approve the draft, saves approved notes locally, and exports them as Markdown or PDF for revision.

This project is built for a practical study workflow:

- Capture the current lecture slide
- Generate a concise UPSC-focused draft
- Review and edit the draft manually
- Approve it into local notes
- Save notes for revision and export them later
- Optionally use a local Ollama model for free, private AI processing

---

## Project goal

The extension is designed for students who want to:

- convert lecture slides into quick revision notes
- keep notes local to the browser profile
- avoid heavy or noisy AI outputs during class
- use a free local model instead of monthly cloud API costs
- maintain a simple study flow: Slide → Draft → Approval → Notes

---

## Features

- Chrome side panel UI for managing study notes
- Active tab slide capture from the visible lecture screen
- Optional watcher that checks the current visible tab every 5 seconds
- AI summarization using a selected provider
- Local Ollama support with qwen2.5vl:7b recommended
- OpenRouter and Gemini fallback support
- Manual draft review and editing
- Approval of notes into local storage
- Markdown export and PDF print export
- Voice command support when browser microphone access is enabled
- Instruction-driven research / question answering for UPSC-focused concepts

---

## Recommended AI setup

For the most stable and cost-free long-term flow, use Ollama locally.

Recommended model:

- qwen2.5vl:7b

Typical local endpoint:

- http://localhost:11434/api/generate

If your extension is running in Chrome, ensure Ollama allows the extension origin. In Windows, this is often required:

```powershell
$env:OLLAMA_ORIGINS = 'chrome-extension://*'
& "C:\Users\HP\AppData\Local\Programs\Ollama\ollama.exe" serve
```

For full persistence, you may set the environment variable for the user profile.

---

## Repository file map

### Core extension files

- `manifest.json`  
  Chrome extension manifest, permissions, side panel config, and host permissions.

- `background.js`  
  Background service worker used to open the side panel and handle capture requests.

- `sidepanel.html`  
  Main panel UI with areas for watcher, draft, research, notes, and export actions.

- `sidepanel.js`  
  Main application logic:
  - slide capture
  - AI provider logic
  - Ollama/OpenRouter/Gemini calls
  - watcher logic
  - notes storage
  - draft editing and export functions

- `options.html`  
  Settings page for selecting the preferred AI provider and entering API keys.

- `options.js`  
  Saves and loads provider settings and API credentials in Chrome local storage.

- `styles.css`  
  Styling for the side panel and options views.

### Supporting files

- `README.md`  
  Complete project guide.

- `README.txt`  
  Older project readme kept for reference or legacy documentation.

---

## How the extension works

### 1. Capture

The user opens a lecture tab and clicks Capture now or starts the watcher. The extension captures the visible screen region and turns it into an image.

### 2. Summarize

The captured image is passed to the selected AI provider with a focused UPSC summary prompt. The output is a concise draft rather than a long essay.

### 3. Review and edit

The draft appears in the editor area. The user can:

- edit the text
- approve it to notes
- star important points
- Save the draft as part of revision notes

### 4. Research and validation

The user can ask AI questions about the topic, paste source excerpts, and analyze them for UPSC relevance without needing to fully rewrite the whole note.

### 5. Export

Approved notes can be:

- downloaded as Markdown
- printed and saved as PDF
- kept locally in the browser profile for future revision

---

## How to install and run

### 1. Open the project in Chrome

1. Open `chrome://extensions`
2. Turn on Developer Mode
3. Click Load unpacked
4. Select this project folder

### 2. Open the extension

- Click the extension icon in Chrome
- The side panel will open

### 3. Configure AI provider

Open Settings / API key from the extension panel and choose one of the following:

- Ollama (recommended for free local use)
- OpenRouter (optional cloud fallback)
- Gemini (optional cloud fallback)

### 4. Run Ollama locally (recommended)

If using Ollama:

```powershell
ollama pull qwen2.5vl:7b
ollama serve
```

Then in the extension settings:

- Provider = Ollama
- Model = qwen2.5vl:7b

### 5. Start using it

- Open a lecture tab
- Click Capture now
- Or start the watcher
- Review the generated draft
- Approve notes and export later

---

## Important notes

### Privacy and local storage

- notes are stored in the browser profile local storage
- the extension keeps data locally unless you send it to a selected AI provider
- if you use cloud AI, your slide and prompt go to that provider

### Watcher mode

Watcher mode checks the visible tab every 5 seconds and only triggers AI when the image changed. Keep the lecture tab active and visible for the best behavior.

### Practical usage advice

This tool is best used as a revision assistant rather than a fully automated note-generation machine. The design purposely keeps outputs concise and revision-friendly.

---

## Best long-term workflow

For UPSC study, the recommended workflow is:

1. Use the local model for summaries
2. Keep notes locally in the browser
3. Download Markdown after each study session
4. Keep a backup in OneDrive / Google Drive / Dropbox
5. Export selected topics as PDF for revision before exams

This gives a clean balance between:

- speed
- privacy
- no API cost
- long-term revision continuity

---

## Project status

This project is a working prototype extension for study assistance. It is intended for personal academic use and revision workflows, not as a commercial SaaS product.

---

## License

This project is currently a local study extension without a formal public license file. If you plan to distribute or reuse it, add a license before public publishing.

---

## Contribution / next improvements

Potential future enhancements include:

- better note export folders by subject/date
- improved local JSON backup/export system
- automatic Markdown archive management
- cleaner prompt templates for different UPSC subjects
- more robust browser permission handling
- multi-subject note organization

---

## Summary

UPSC Lecture Companion is a practical browser extension for lecture capture, AI-assisted revision, and local note management. It is centered around a simple pattern:

Slide → Draft → Review → Approved Notes → Markdown/PDF export

This makes the tool especially useful for UPSC preparation, where concise, accurate, revision-friendly notes matter more than long generic AI output.
