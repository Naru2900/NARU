/* =========================================================
   NARU — Settings Module
   Loads / saves user preferences (language mode, AI provider,
   model, conversation mode). Persisted in localStorage.
   ========================================================= */

const NaruSettings = (() => {
  const KEY = "naru.settings.v1";

  const DEFAULTS = {
    langMode: "auto", // "auto" | "en" | "hi"
    provider: "ollama", // local AI provider (default, no paid API)
    model: "llama3.2", // Ollama model used for conversation
    aiBaseUrl: "/ollama", // served by server.rb proxy -> http://127.0.0.1:11434
    continuous: true, // continuous conversation mode (auto re-listen)
  };

  let data = Object.assign({}, DEFAULTS);

  function canStore() {
    try {
      return (
        typeof localStorage !== "undefined" &&
        typeof localStorage.getItem === "function"
      );
    } catch (err) {
      return false;
    }
  }

  function load() {
    try {
      if (!canStore()) return;
      const raw = localStorage.getItem(KEY);
      if (raw) data = Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (err) {
      data = Object.assign({}, DEFAULTS);
    }
  }

  function persist() {
    try {
      if (canStore()) localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      /* storage unavailable — settings are session-only */
    }
  }

  load();

  return {
    get(key) {
      return key in data ? data[key] : DEFAULTS[key];
    },
    set(key, value) {
      data[key] = value;
      persist();
    },
    getAll() {
      return Object.assign({}, data);
    },
    reset() {
      data = Object.assign({}, DEFAULTS);
      persist();
    },
  };
})();