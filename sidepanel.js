const $ = id => document.getElementById(id);
let watcher = null;
let lastImageSignature = "";
let currentSlide = null;
let currentDraft = "";
let currentSlideTitle = "";
let busy = false;
let notes = [];

const promptForSlide = `You are a careful UPSC CSE study assistant. Read this lecture slide and produce a very short editable draft in plain text with only 5 parts: (1) Topic/title, (2) One-line concept, (3) 3-5 important facts, (4) UPSC relevance, (5) Any uncertainty. Include exact article numbers, constitutional provisions, and names when they are visible on the slide. Keep it brief, accurate, and easy to revise. Do not invent facts. If a fact is not clear, label it as uncertain.`;

function setStatus(id, text) { if ($(id)) { $(id).textContent = text; } }
function setSystemStatus(message, kind = "info") {
  const node = $("systemStatus");
  if (!node) return;
  node.textContent = message;
  node.className = `status-banner ${kind}`;
}
function formatShortTime(dateValue) {
  const date = new Date(dateValue || Date.now());
  return Number.isNaN(date.getTime()) ? "just now" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
function isPermissionProblem(errorText) {
  const text = (errorText || "").toLowerCase();
  return text.includes("<all_urls>") || text.includes("activeTab") || text.includes("permission");
}
function showCapturePermissionHint() {
  const message = "Capture blocked by Chrome. Open the lecture tab, click the extension icon once to grant access, then retry Capture now.";
  setStatus("captureMeta", message);
  alert(message);
}
function ensureCaptureEnvironment(tab) {
  const manifestPermissions = chrome.runtime.getManifest().permissions || [];
  const manifestHosts = chrome.runtime.getManifest().host_permissions || [];
  const hasPermission = manifestPermissions.includes("activeTab") || manifestHosts.includes("<all_urls>");

  if (!hasPermission) {
    throw new Error("Either the '<all_urls>' or 'activeTab' permission is required.");
  }

  if (!tab || !tab.id) {
    throw new Error("No active lecture tab found.");
  }

  if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) {
    throw new Error("Use the extension on a lecture page, not a Chrome internal page.");
  }
}
function dataUrlBase64(url) { return url.split(",")[1] || ""; }
function buildFocusedAnswerPrompt(question, includeSlideContext = false) {
  return `You are a careful UPSC CSE study assistant. Answer only the exact question asked. Keep it tight and practical. Do not broaden into unrelated topics. Use the slide only if it directly helps answer the question. Output in this order: 1) 1-line direct answer, 2) 4-8 short bullet points, 3) 1-2 UPSC relevance lines. Use official names and articles only when clearly supported. If something is uncertain, label it as uncertain. Max 180 words.\n\nUser question: ${question}`;
}
function buildFocusedResearchPrompt(question, pastedText = "") {
  const sourceText = pastedText ? `\n\nUser-provided source excerpt:\n${pastedText}` : "";
  return `Analyze the topic for UPSC relevance using only what is directly needed. Do not write an essay or broad background. Give: (1) short concept, (2) exact list of important points, (3) 2-4 UPSC-focused relevance points, (4) any uncertainty. Keep it concise, structured, and fact-based. Max 220 words.\n\nUser request: ${question}${sourceText}`;
}
function signature(dataUrl) {
  // Compare captured image payloads exactly. A changed image triggers AI once.
  return dataUrl;
}
// async function capture() {
//   const result = await chrome.runtime.sendMessage({type:"CAPTURE_VISIBLE_TAB"});
//   if (!result?.ok) throw new Error(result?.error || "Capture failed. Try clicking the extension icon on the lecture tab, then capture again.");
//   currentSlide = result.dataUrl;
//   currentSlideTitle = result.tabTitle || "Lecture slide";
//   $("slidePreview").src = currentSlide;
//   $("slidePreview").classList.remove("hidden");
//   setStatus("captureMeta", `Captured from: ${currentSlideTitle}`);
//   return result;
// }


async function capture() {
  try {
    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    });

    const tab = tabs[0];
    ensureCaptureEnvironment(tab);

    console.log("Capture diagnostic:", {
      tabId: tab.id,
      windowId: tab.windowId,
      url: tab.url,
      activeTabDeclared:
        chrome.runtime.getManifest().permissions?.includes("activeTab")
    });

    const dataUrl = await chrome.tabs.captureVisibleTab(
      tab.windowId,
      { format: "jpeg", quality: 60 }
    );

    currentSlide = dataUrl;
    currentSlideTitle = tab.title || "Lecture slide";

    $("slidePreview").src = currentSlide;
    $("slidePreview").classList.remove("hidden");
    setStatus("captureMeta", `Captured from: ${currentSlideTitle}`);

    return {
      ok: true,
      dataUrl,
      tabTitle: currentSlideTitle,
      tabUrl: tab.url || ""
    };
  } catch (error) {
    console.error("Slide capture failed:", error);
    const msg = error?.message || String(error);
    const permissionIssue = isPermissionProblem(msg);
    if (permissionIssue) {
      showCapturePermissionHint();
    }
    const permissionHint = permissionIssue
      ? " The extension needs permission to capture the active lecture tab. Please reload the extension, keep the lecture tab active, and click the extension icon once before retrying."
      : "";
    throw new Error(`Slide capture failed: ${msg}${permissionHint}`);
  }
}

async function getAISettings() {
  const d = await chrome.storage.local.get(["geminiApiKey", "provider", "ollamaModel", "openRouterApiKey", "openRouterModel"]);
  const validProviders = ["ollama", "openrouter", "gemini"];
  const provider = validProviders.includes(d.provider) ? d.provider : "ollama";

  return {
    provider,
    geminiApiKey: (d.geminiApiKey || "").trim(),
    ollamaModel: d.ollamaModel || "qwen2.5vl:7b",
    openRouterApiKey: (d.openRouterApiKey || "").trim(),
    openRouterModel: d.openRouterModel || "meta-llama/llama-3.2-11b-vision-instruct"
  };
}

async function callOllama(prompt, imageUrl = null, pastedText = "") {
  const settings = await getAISettings();
  const finalPrompt = prompt + (pastedText ? "\n\nUser-provided research/source excerpts:\n" + pastedText : "");
  const data = {
    model: settings.ollamaModel,
    prompt: finalPrompt,
    stream: false
  };

  if (imageUrl) data.images = [dataUrlBase64(imageUrl)];

  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed (${response.status}). Make sure Ollama is running and the model is installed.`);
  }

  const json = await response.json().catch(() => ({}));
  const text = (json?.response || "").trim();
  if (!text) {
    throw new Error("Ollama returned no text. Try a different model or check the local server.");
  }
  return text;
}

async function callOpenRouter(prompt, imageUrl = null, pastedText = "") {
  const settings = await getAISettings();
  const key = settings.openRouterApiKey;
  if (!key) throw new Error("No OpenRouter API key saved. Add it in Settings or choose another provider.");

  const finalPrompt = prompt + (pastedText ? "\n\nUser-provided research/source excerpts:\n" + pastedText : "");
  const content = [{ type: "text", text: finalPrompt }];
  if (imageUrl) {
    content.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://localhost"
    },
    body: JSON.stringify({
      model: settings.openRouterModel,
      messages: [{ role: "user", content }],
      temperature: 0.2,
      max_tokens: 700
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenRouter request failed (${response.status}).`);
  }

  const contentText = data?.choices?.[0]?.message?.content;
  const text = Array.isArray(contentText)
    ? contentText.map(part => typeof part === "string" ? part : part?.text || "").join("")
    : (typeof contentText === "string" ? contentText : "");

  if (!text.trim()) {
    throw new Error("OpenRouter returned no text. Try another model or key.");
  }
  return text.trim();
}

async function callGemini(prompt, imageUrl = null, pastedText = "") {
  const settings = await getAISettings();
  const key = settings.geminiApiKey;
  if (!key) throw new Error("No Gemini API key saved. Open Settings / API key first. You can still use capture and local notes.");

  const parts = [{text: prompt + (pastedText ? "\n\nUser-provided research/source excerpts:\n" + pastedText : "")}];
  if (imageUrl) parts.push({inline_data:{mime_type:"image/jpeg", data:dataUrlBase64(imageUrl)}});

  const modelName = "gemini-3.8-flash";

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(modelName) + ":generateContent?key=" + encodeURIComponent(key), {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        contents:[{role:"user",parts}],
        generationConfig:{
          temperature:0.2,
          maxOutputTokens:700,
          thinkingConfig:{thinkingBudget:0}
        }
      })
    });

    const data = await response.json().catch(()=>({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || `Gemini request failed (${response.status}). Check your API key, model access, and free-tier quota.`);
    }

    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.map(p=>p.text || "").join("").trim();

    if (!text) {
      throw new Error("AI returned no text. Try again or check quota.");
    }

    if (candidate?.finishReason === "MAX_TOKENS") {
      return text + "\n\n[Response was cut off because the model hit the output limit. Ask: 'Continue from the last point.' ]";
    }

    return text;
  } catch (error) {
    throw new Error(error?.message || "AI request failed. Check your API key, model access, and free-tier quota.");
  }
}

async function callAI(prompt, imageUrl = null, pastedText = "", options = {}) {
  const settings = await getAISettings();
  const selectedProvider = settings.provider || "ollama";
  const providerOrder = [selectedProvider, "ollama", "openrouter", "gemini"].filter((value, index, arr) => arr.indexOf(value) === index);

  if (!providerOrder.includes("ollama") && !providerOrder.includes("openrouter") && !providerOrder.includes("gemini")) {
    throw new Error("No valid AI provider selected. Choose Ollama, OpenRouter, or Gemini.");
  }

  const shouldUseImage = Boolean(imageUrl && (options.forceImage || /slide|image|diagram|chart|visual|page/i.test(prompt || "")));
  const imageForRequest = shouldUseImage ? imageUrl : null;
  const fallbackLabel = options.label || "AI request";
  let lastError = null;

  for (const provider of providerOrder) {
    try {
      if (provider === "ollama") {
        setSystemStatus(`${fallbackLabel}: using local Ollama…`, "info");
        const result = await callOllama(prompt, imageForRequest, pastedText);
        setSystemStatus(`${fallbackLabel} finished with local Ollama.`, "success");
        return result;
      }
      if (provider === "openrouter") {
        setSystemStatus(`${fallbackLabel}: using OpenRouter…`, "info");
        const result = await callOpenRouter(prompt, imageForRequest, pastedText);
        setSystemStatus(`${fallbackLabel} finished with OpenRouter.`, "success");
        return result;
      }
      if (provider === "gemini") {
        setSystemStatus(`${fallbackLabel}: using Gemini…`, "info");
        const result = await callGemini(prompt, imageForRequest, pastedText);
        setSystemStatus(`${fallbackLabel} finished with Gemini.`, "success");
        return result;
      }
    } catch (error) {
      lastError = error;
      console.warn(`AI provider fallback: ${provider} failed`, error);
      if (provider !== selectedProvider) {
        setSystemStatus(`${fallbackLabel}: ${provider} failed. Trying next option…`, "warning");
      }
    }
  }

  throw lastError || new Error("All AI providers failed. Check your settings and API keys.");
}

async function callGeminiLegacy(prompt, imageUrl = null, pastedText = "") {
  return callAI(prompt, imageUrl, pastedText);
}
async function summarizeCurrentSlide() {
  if (!currentSlide) { setStatus("draftStatus","Capture a slide first"); setSystemStatus("No slide captured yet.", "warning"); return; }
  if (busy) return;
  busy = true; setStatus("draftStatus","Summarizing…"); setSystemStatus("Summarizing the current slide with the local model…", "info");
  try {
    currentDraft = await callAI(promptForSlide, currentSlide, "", { label: "Slide summary", forceImage: true });
    $("draftText").textContent = currentDraft;
    $("draftEditor").value = currentDraft;
    $("approveDraft").disabled = false;
    setStatus("draftStatus","Draft ready");
    setSystemStatus("Draft ready for review and approval.", "success");
  } catch(e) {
    $("draftText").textContent = e.message;
    setStatus("draftStatus","Needs attention");
    setSystemStatus(`Summary failed: ${e.message}`, "error");
  } finally { busy = false; }
}
async function addMissingDetailToDraft() {
  const existingDraft = ($("draftEditor").value || currentDraft || "").trim();
  if (!existingDraft) {
    setSystemStatus("Capture or summarize a slide first before adding missing details.", "warning");
    return;
  }

  const missingDetailRequest = ($("commandInput").value || "Add only the missing article numbers, names, and exact constitutional references visible on the slide. Keep the same draft structure and do not rewrite what is already correct.").trim();

  try {
    setSystemStatus("Adding missing article and fact details to the current draft…", "info");
    const updated = await callAI(`Update the existing draft with only the missing exact details requested. Keep the current structure and wording where it is already correct. Add only the missing article numbers, names, constitutional references, and precise facts. Do not add broad background or unrelated content. Do not rephrase existing correct points. Output only the revised draft text.\n\nExisting draft:\n${existingDraft}\n\nRequested missing detail: ${missingDetailRequest}`, null, $("researchNotes").value.trim(), { label: "Draft refinement" });

    currentDraft = updated.trim();
    $("draftText").textContent = currentDraft;
    $("draftEditor").value = currentDraft;
    $("approveDraft").disabled = false;
    setStatus("draftStatus", "Draft refined");
    setSystemStatus("Missing details added to the draft.", "success");
  } catch (error) {
    setSystemStatus(`Could not add missing detail: ${error.message}`, "error");
    $("draftText").textContent = error.message;
  }
}
async function handleCapture(manual = true) {
  try {
    await capture();
    const sig = signature(currentSlide);
    if (manual || sig !== lastImageSignature) {
      lastImageSignature = sig;
      await summarizeCurrentSlide();
    }
  } catch(e) {
    $("draftText").textContent = e.message;
    setStatus("draftStatus","Capture error");
  }
}
function normalizeDraft() { currentDraft = $("draftEditor").value.trim(); $("draftText").textContent = currentDraft || "Draft is empty."; }
async function getNotes() {
  const d = await chrome.storage.local.get(["approvedNotes"]);
  notes = Array.isArray(d.approvedNotes) ? d.approvedNotes : [];
  renderNotes();
}
async function saveNotes() {
  try {
    await chrome.storage.local.set({ approvedNotes: notes });
    renderNotes();
    setSystemStatus(`Saved ${notes.length} note${notes.length === 1 ? "" : "s"} locally.`, "success");
    return true;
  } catch (error) {
    setSystemStatus(`Could not save notes: ${error.message || String(error)}`, "error");
    return false;
  }
}
function renderNotes() {
  $("noteCount").textContent = `${notes.length} note${notes.length===1?"":"s"}`;
  const root = $("notesList"); root.innerHTML = "";
  if (!notes.length) { root.innerHTML = '<div class="hint">No approved notes yet. Approve a draft or add researched material when you are ready.</div>'; return; }
  notes.forEach((note, index) => {
    const card = document.createElement("article"); card.className = "note" + (note.starred ? " starred" : "");
    const title = document.createElement("div"); title.className="note-title"; title.textContent = `${note.starred ? "★ STARRED · " : ""}${note.title || "Lecture note"} · ${formatShortTime(note.updatedAt || note.createdAt)}`;
    const body = document.createElement("div"); body.className="note-body"; body.textContent=note.text;
    const actions=document.createElement("div"); actions.className="note-actions";
    const edit=document.createElement("button"); edit.textContent="Edit"; edit.onclick=async()=>{const val=prompt("Edit this note:",note.text);if(val!==null){note.text=val.trim();note.updatedAt=Date.now();await saveNotes();}};
    const star=document.createElement("button"); star.textContent=note.starred?"Unstar":"★ Star"; star.onclick=async()=>{note.starred=!note.starred;await saveNotes();};
    const del=document.createElement("button"); del.textContent="Delete"; del.onclick=async()=>{if(confirm("Delete this note?")){notes.splice(index,1);await saveNotes();}};
    actions.append(edit,star,del); card.append(title,body,actions); root.append(card);
  });
}
async function addNote(text, title, starred=false) {
  const cleanText = (text || "").trim();
  if (!cleanText) { alert("There is no text to add."); return; }
  notes.unshift({id:crypto.randomUUID(),title:title||currentSlideTitle||"UPSC note",text:cleanText,starred,createdAt:Date.now(),updatedAt:Date.now()});
  await saveNotes();
}
function buildNotesMarkdown() {
  return "# UPSC Class Notes\n\n" + notes.map((n, idx) => {
    const title = (n.title || `Note ${idx + 1}`).replace(/\r?\n/g, " ");
    return `${n.starred ? "★ " : ""}## ${title}\n\n${n.text || ""}\n`;
  }).join("\n---\n\n") || "# UPSC Class Notes\n\nNo notes saved yet.\n";
}
function buildNotesPrintHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>UPSC Notes Export</title><style>body{font-family:Segoe UI,sans-serif;padding:24px;color:#111;} h1{margin-bottom:12px;} .note{border:1px solid #d9dce3;padding:14px;border-radius:10px;margin-bottom:14px;} .meta{font-size:12px;color:#555;margin-bottom:8px;} .body{white-space:pre-wrap;line-height:1.6;}</style></head><body><h1>UPSC Class Notes</h1>${notes.map((n, idx) => `<section class="note"><div class="meta">${n.starred ? "★ Starred • " : ""}${n.title || "Note " + (idx + 1)} • ${formatShortTime(n.updatedAt || n.createdAt)}</div><div class="body">${(n.text || "").replace(/\n/g, "<br>")}</div></section>`).join("")} </body></html>`;
}
$("captureNow").addEventListener("click",()=>handleCapture(true));
$("refreshNotes").addEventListener("click",async()=>{ await getNotes(); setSystemStatus("Notes refreshed.", "success"); });
$("startWatch").addEventListener("click",async()=>{
  if(watcher) return;
  setStatus("watchStatus","Starting…"); $("startWatch").disabled=true; $("pauseWatch").disabled=false;
  await handleCapture(true);
  watcher=setInterval(async()=>{
    if(document.hidden || busy) return;
    try {
      const previous=lastImageSignature;
      await capture();
      const next=signature(currentSlide);
      if(next!==previous){lastImageSignature=next; await summarizeCurrentSlide();}
    } catch(e){ setStatus("captureMeta",`Watcher paused/error: ${e.message}`); }
  },5000);
  setStatus("watchStatus","Running");
});
$("pauseWatch").addEventListener("click",()=>{if(watcher)clearInterval(watcher);watcher=null;$("startWatch").disabled=false;$("pauseWatch").disabled=true;setStatus("watchStatus","Paused");});
$("regenerate").addEventListener("click",()=>summarizeCurrentSlide());
$("addMissingDetail").addEventListener("click",()=>addMissingDetailToDraft());
$("saveEditedDraft").addEventListener("click",()=>{normalizeDraft();setStatus("draftStatus","Draft updated");$("approveDraft").disabled=!currentDraft;});
$("approveDraft").addEventListener("click",async()=>{normalizeDraft();await addNote(currentDraft,currentSlideTitle,false);setStatus("draftStatus","Approved to notes");});
$("starDraft").addEventListener("click",async()=>{normalizeDraft();await addNote(currentDraft,currentSlideTitle,true);setStatus("draftStatus","Starred note saved");});
$("askAI").addEventListener("click",async()=>{
  const q=$("commandInput").value.trim(); if(!q){alert("Enter a question or command first.");return;}
  const useSlideContext = /slide|image|diagram|chart|visual|current|page/i.test(q);
  setSystemStatus(useSlideContext ? "Asking AI with the current slide as context…" : "Asking AI without the slide image to keep it fast…", "info");
  setStatus("answerBox","Thinking…");
  try {
    const ans=await callAI(buildFocusedAnswerPrompt(q, useSlideContext), useSlideContext ? currentSlide : null, $("researchNotes").value.trim(), { label: "Answer request" });
    $("answerBox").textContent=ans;
    setSystemStatus("Answer ready.", "success");
  }
  catch(e){$("answerBox").textContent=e.message; setSystemStatus(`Answer failed: ${e.message}`, "error");}
});
$("googleResearch").addEventListener("click",async()=>{
  const q=$("commandInput").value.trim() || $("draftEditor").value.trim().slice(0,180) || currentSlideTitle;
  if(!q){alert("Enter a topic or capture a slide first.");return;}
  const exactPhrase = q.trim().replace(/\s+/g, " ");
  const searchQ = `${exactPhrase} UPSC PYQ official source site:upsc.gov.in OR site:indiankanoon.com OR site:legislative.gov.in`;
  await chrome.tabs.create({url:"https://www.google.com/search?q="+encodeURIComponent(searchQ)});
});
$("analyzeResearch").addEventListener("click",async()=>{
  const pasted=$("researchNotes").value.trim(), q=$("commandInput").value.trim()||"Analyze the pasted research for UPSC relevance and concise notes.";
  if(!pasted){alert("Paste the research/source excerpt first.");return;}
  setSystemStatus("Analyzing pasted research for UPSC relevance…", "info");
  setStatus("answerBox","Analyzing pasted research…");
  try{
    $("answerBox").textContent=await callAI(buildFocusedResearchPrompt(q, pasted), null, pasted, { label: "Research analysis" });
    setSystemStatus("Research notes analyzed.", "success");
  }
  catch(e){$("answerBox").textContent=e.message; setSystemStatus(`Research analysis failed: ${e.message}`, "error");}
});
$("addResearch").addEventListener("click",async()=>{const txt=$("researchNotes").value.trim(); if(!txt){alert("Paste some research first."); return;} await addNote(txt,"Research · "+(currentSlideTitle||"UPSC topic"),false);});
$("exportNotes").addEventListener("click",()=>{
  if (!notes.length) { alert("No notes saved yet. Approve a draft or add research before exporting."); return; }
  const printWindow = window.open("", "_blank", "width=980,height=720");
  if (!printWindow) { alert("Please allow popups to export notes as PDF."); return; }
  printWindow.document.write(buildNotesPrintHtml());
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    setSystemStatus("Export window opened. Use Save as PDF in the print dialog.", "success");
  }, 300);
});
$("downloadNotes").addEventListener("click",()=>{
  if (!notes.length) { alert("No notes saved yet. Approve a draft or add research before downloading."); return; }
  const md = buildNotesMarkdown();
  const blob=new Blob([md],{type:"text/markdown;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="upsc-class-notes.md";a.click();URL.revokeObjectURL(url);
  setSystemStatus("Markdown notes downloaded.", "success");
});
let recognition=null;
async function ensureMicrophonePermission() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("micStatus", "Microphone API unavailable in this browser. Use typed commands instead.");
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    const reason = error?.name || "PermissionDeniedError";
    const userMessage = reason === "NotAllowedError" || reason === "PermissionDeniedError"
      ? "Microphone blocked by browser settings. Open Chrome settings > Site settings > Microphone, allow it for this extension, then retry. If not possible, type your command instead."
      : `Microphone access failed: ${reason}. Use typed commands instead.`;
    setStatus("micStatus", userMessage);
    return false;
  }
}
$("micButton").addEventListener("click",async()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){setStatus("micStatus","Voice recognition unavailable here. Use typed commands.");return;}
  if(recognition){recognition.stop();recognition=null;$("micButton").textContent="🎙 Voice command";return;}

  const permissionOk = await ensureMicrophonePermission();
  if (!permissionOk) return;

  recognition=new SR();
  recognition.lang="en-IN";
  recognition.interimResults=false;
  recognition.maxAlternatives=1;

  recognition.onstart=()=>{setStatus("micStatus","Listening… speak your command");$("micButton").textContent="Stop listening";};
  recognition.onerror=e=>{
    const reason = e?.error || "unknown";
    const userMessage = reason === "not-allowed"
      ? "Microphone blocked by browser settings. Open Chrome settings > Site settings > Microphone, allow it for this extension, then retry. If not possible, type your command instead."
      : `Mic error: ${reason}. Use typed commands if blocked.`;
    setStatus("micStatus", userMessage);
    $("micButton").textContent = "🎙 Voice command";
    recognition = null;
  };
  recognition.onresult=e=>{$("commandInput").value=e.results[0][0].transcript;setStatus("micStatus","Command captured. Click Ask AI or Search Google.");};
  recognition.onend=()=>{$("micButton").textContent="🎙 Voice command";recognition=null;};

  try{recognition.start();}catch(e){setStatus("micStatus","Microphone could not start. Try typed commands.");}
});
getNotes();
setSystemStatus("Ready. Capture a slide or start the watcher.", "info");