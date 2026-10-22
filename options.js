const keyInput = document.getElementById("apiKey");
const providerInput = document.getElementById("provider");
const ollamaModelInput = document.getElementById("ollamaModel");
const openRouterApiKeyInput = document.getElementById("openRouterApiKey");
const openRouterModelInput = document.getElementById("openRouterModel");
const status = document.getElementById("status");

chrome.storage.local.get(["geminiApiKey", "provider", "ollamaModel", "openRouterApiKey", "openRouterModel"], data => {
  if (data.geminiApiKey) keyInput.value = data.geminiApiKey;
  if (data.provider) providerInput.value = data.provider;
  if (data.ollamaModel) ollamaModelInput.value = data.ollamaModel;
  if (data.openRouterApiKey) openRouterApiKeyInput.value = data.openRouterApiKey;
  if (data.openRouterModel) openRouterModelInput.value = data.openRouterModel;
});

document.getElementById("saveKey").addEventListener("click", async () => {
  const key = keyInput.value.trim();
  const openRouterKey = openRouterApiKeyInput.value.trim();
  const provider = providerInput.value;
  const ollamaModel = ollamaModelInput.value.trim() || "qwen2.5vl:7b";
  const openRouterModel = openRouterModelInput.value.trim() || "meta-llama/llama-3.2-11b-vision-instruct";

  if (!key && !openRouterKey && provider !== "ollama") {
    status.textContent = "Add at least one API key or choose Ollama local mode.";
    return;
  }

  await chrome.storage.local.set({
    geminiApiKey: key,
    provider,
    ollamaModel,
    openRouterApiKey: openRouterKey,
    openRouterModel
  });
  status.textContent = "Saved locally in this Chrome profile.";
});

document.getElementById("clearKey").addEventListener("click", async () => {
  await chrome.storage.local.remove(["geminiApiKey", "provider", "ollamaModel", "openRouterApiKey", "openRouterModel"]);
  keyInput.value = "";
  providerInput.value = "ollama";
  ollamaModelInput.value = "qwen2.5vl:7b";
  openRouterApiKeyInput.value = "";
  openRouterModelInput.value = "meta-llama/llama-3.2-11b-vision-instruct";
  status.textContent = "Keys and provider settings removed.";
});