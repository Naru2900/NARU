/* =========================================================
   NARU — Conversation Memory Module
   Keeps the current session's conversation, the user's name
   and short notes. Persisted in localStorage when available.
   ========================================================= */

const NaruMemory = (() => {
  const KEY = "naru.memory.v1";
  const MAX_MESSAGES = 30; // keep context reasonably small

  let items = []; // [{ role: "user"|"assistant", content, at }]
  let user = { name: null };
  let notes = [];

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
      if (!raw) return;
      const data = JSON.parse(raw);
      items = Array.isArray(data.items) ? data.items : [];
      user = data.user || { name: null };
      notes = Array.isArray(data.notes) ? data.notes : [];
    } catch (err) {
      items = [];
      user = { name: null };
      notes = [];
    }
  }

  function persist() {
    try {
      if (canStore()) {
        localStorage.setItem(KEY, JSON.stringify({ items, user, notes }));
      }
    } catch (err) {
      /* best-effort */
    }
  }

  load();

  return {
    /**
     * Append a message to the conversation.
     * @param {"user"|"assistant"} role
     * @param {string} content
     */
    add(role, content) {
      if (!content) return;
      items.push({ role, content, at: new Date().toISOString() });
      if (items.length > MAX_MESSAGES) {
        items.splice(0, items.length - MAX_MESSAGES);
      }
      persist();
    },
    get() {
      return items.slice();
    },
    /** Most recent `n` messages as plain {role, content}. */
    getRecent(n) {
      const size = Math.max(1, n || 12);
      return items.slice(-size).map((m) => ({ role: m.role, content: m.content }));
    },
    clear() {
      items = [];
      persist();
    },
    getUser() {
      return Object.assign({}, user);
    },
    setUserName(name) {
      if (name && typeof name === "string") {
        user.name = name.trim();
        persist();
      }
    },
    isUserKnown() {
      return !!(user.name && user.name.length);
    },
    addNote(text) {
      if (!text) return;
      notes.push(String(text).trim());
      if (notes.length > 20) notes = notes.slice(-20);
      persist();
    },
    getNotes() {
      return notes.slice();
    },
    clearNotes() {
      notes = [];
      persist();
    },
  };
})();