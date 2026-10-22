UPSC Lecture Companion v0.3 (unpacked Chrome extension)

WHAT THIS BUILD DOES
- Opens a Chrome side panel.
- Captures the visible active tab when you click Capture now.
- Optional watcher checks the visible tab every 5 seconds while enabled. It attempts to detect image changes and asks Gemini for a summary when it detects a change.
- AI summaries and AI answers require your own Gemini API key; the extension does not include a key or paid plan.
- Lets you edit a draft, approve it into local notes, star a draft, edit/star/delete approved notes, and export Markdown or print/save as PDF.
- Google Search button opens a search tab; it does not scrape Google results automatically.
- Voice command uses browser SpeechRecognition if available; typed commands are always available.

INSTALL
1. Extract the ZIP to a normal folder.
2. Open chrome://extensions in Chrome.
3. Enable Developer mode.
4. Click Load unpacked and select the extracted folder containing manifest.json.
5. Click the extension icon to open the side panel.
6. Open Settings / API key in the side panel and paste your Gemini API key from Google AI Studio.
7. Return to the lecture tab. Keep the tab visible and start watcher, or use Capture now.

IMPORTANT LIMITATIONS
- This is an early prototype, not a polished production extension.
- It captures only the visible viewport, not the full lecture or hidden slides.
- Watcher uses periodic screenshot comparison; animation, cursor movement, timers, or video changes can trigger extra summaries. For fast lectures, Pause the watcher and use Capture now until tuned. AI quotas/rate limits may also interrupt automatic summaries.
- If Chrome rejects capture, click the extension icon while the lecture tab is active, then try again. The activeTab permission is intentionally narrow.
- Gemini free-tier access, model availability, quotas, and terms may change. The API request sends the captured slide and prompt to Google. Review the current terms and avoid sending content you do not want processed by that service.
- The API key is stored in local extension storage, not encrypted as a secret vault. Do not share your Chrome profile or extension folder with the key included.
- Browser speech recognition may depend on Chrome/device support and may process speech through an online service; typed commands are the fallback.
- Research button opens Google Search. It does not independently verify sources or automatically import results; paste useful source excerpts into the research box and click Analyze pasted research.
- This build does not capture teacher audio.
