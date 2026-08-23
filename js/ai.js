/* =========================================================
   NARU — AI Conversation Engine
   A clean, configurable provider interface. The default
   provider is Ollama (a free, local model). Additional
   providers can be registered with register() later.
   No paid API is used and no API keys live in this code.
   ========================================================= */

const NaruAI = (() => {
  const providers = {};
  let current = "ollama";
  let lastError = null;

  /**
   * Register (or replace) a provider.
   * A provider must expose:
   *   - async available()  -> boolean
   *   - async chat(messages) -> string (assistant reply)
   */
  function register(name, provider) {
    providers[name] = provider;
    if (!providers[current]) current = name;
  }

  function setProvider(name) {
    if (providers[name]) current = name;
  }

  function getProvider() {
    return current;
  }

  function listProviders() {
    return Object.keys(providers);
  }

  function getLastError() {
    return lastError;
  }

  async function isAvailable() {
    const provider = providers[current];
    if (!provider) return false;
    try {
      return !!(await provider.available());
    } catch (err) {
      lastError = err;
      return false;
    }
  }

  /**
   * Send an OpenAI-style messages array to the active provider
   * and return the assistant's reply text.
   * @param {Array<{role:string, content:string}>} messages
   * @returns {Promise<string>}
   */
  async function chat(messages) {
    const provider = providers[current];
    if (!provider) {
      throw new Error("No AI provider is configured.");
    }
    try {
      const reply = await provider.chat(messages);
      return typeof reply === "string" ? reply : "";
    } catch (err) {
      lastError = err;
      throw err;
    }
  }

  /**
   * System prompt that shapes NARU's personality and instructs
   * it to reply in the same language the user is using.
   */
  function systemPrompt(lang) {
    if (lang === "hi" || lang === "hing") {
      return (
        "You are NARU, a calm and intelligent personal voice assistant. " +
        "Keep your answers short, warm and natural, like a helpful friend. " +
        "Reply in the SAME language the user used. If the user speaks Hindi " +
        "or Hinglish (Hindi written in English), answer in that language. " +
        "If the user mentions their name, remember it for the conversation. " +
        "If you don't know something, say so honestly and keep it brief."
      );
    }
    return (
      "You are NARU, a calm and intelligent personal voice assistant. " +
      "Keep your answers short, warm and natural, like a helpful friend. " +
      "Reply in the SAME language the user used (English, Hindi or Hinglish). " +
      "If the user mentions their name, remember it for the conversation. " +
      "If you don't know something, say so honestly and keep it brief."
    );
  }

  /**
   * Convenience wrapper: turn a single user turn + recent memory context
   * into a full messages array.
   */
  function buildMessages(text, history, lang) {
    const messages = [{ role: "system", content: systemPrompt(lang) }];
    (history || []).forEach((m) => {
      messages.push({ role: m.role, content: m.content });
    });
    messages.push({ role: "user", content: text });
    return messages;
  }

  // ---- Default provider: Ollama (local) ------------------------------
  const ollamaBaseUrl = () =>
    NaruSettings.get("aiBaseUrl") || "/ollama";

  register("ollama", {
    async available() {
      try {
        const res = await fetch(ollamaBaseUrl() + "/api/tags", { method: "GET" });
        return !!res.ok;
      } catch (err) {
        return false;
      }
    },
    async chat(messages) {
      const model = NaruSettings.get("model") || "llama3.2";
      const res = await fetch(ollamaBaseUrl() + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: { temperature: 0.7, num_ctx: 2048 },
        }),
      });

      if (!res.ok) {
        let detail = "";
        try {
          const body = await res.json();
          detail = body && body.error ? ": " + body.error : "";
        } catch (err) {
          /* no body */
        }
        throw new Error("Ollama error " + res.status + detail);
      }

      const data = await res.json();
      const content = data && data.message && data.message.content;
      if (typeof content === "string" && content.trim()) {
        return content.trim();
      }
      throw new Error("Ollama returned an empty response.");
    },
  });

  return {
    register,
    setProvider,
    getProvider,
    listProviders,
    isAvailable,
    chat,
    getLastError,
    buildMessages: buildMessages,
  };
})();