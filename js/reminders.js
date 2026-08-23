/* =========================================================
   NARU — Reminders Module
   Understands phrases like "kal mujhe 10 baje yaad dilana",
   schedules them in the browser, and fires spoken reminders.
   ========================================================= */

const NaruReminders = (() => {
  let items = []; // { id, when(Date), what, original }
  let fireHandler = null; // called with reminder text when it fires
  let idCounter = 1;
  const timers = {};

  function setFireHandler(fn) {
    fireHandler = fn;
  }

  /**
   * Parse a natural-language reminder request.
   * Supports:
   *   "remind me to drink water at 5pm"
   *   "kal mujhe 10 baje yaad dilana"
   *   "parso subah 9 baje remind kar dena"
   *   "in 2 minutes yaad dilana"
   * @returns {{when: Date, what: string, ok: boolean}}
   */
  function parse(text) {
    const t = String(text || "").toLowerCase().trim();

    // ---- day offset ----
    let dayOffset = 0;
    if (t.indexOf("parso") !== -1 || t.indexOf("aaj se") === -1)
      dayOffset = 1;
    if (t.includes("kal")) dayOffset = 1;
    if (t.includes("parso")) dayOffset = 2;
    if (t.includes("aaj")) dayOffset = 0;

    const now = new Date();

    // ---- relative time: "in N minutes/hours" ----
    const rel = t.match(
      /in\s+(\d{1,3})\s*(minute|minutes|min|hour|hours|hr|ghante|second|seconds?)/i
    );
    if (rel) {
      const amount = parseInt(rel[1], 10);
      const unit = rel[2].toLowerCase();
      let ms = amount * 60000;
      if (/hour|ghante/.test(unit)) ms = amount * 3600000;
      if (/second/.test(unit)) ms = amount * 1000;
      const when = new Date(now.getTime() + ms);
      return { when, what: "reminder", ok: true };
    }

    // ---- absolute time: "10 baje", "10:30", "5 pm" ----
    const timeMatch = t.match(
      /(\d{1,2})\s*(?::|\.)?\s*(\d{2})?\s*(a\.?m\.?|p\.?m\.?|baje|subah|shaam|sham|raat|dopahar)?/
    );
    if (!timeMatch) return { when: null, what: "", ok: false };

    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2] || "0", 10);
    let h = hour;
    let mod = (timeMatch[3] || "").toLowerCase();

    if (mod.includes("pm") && h < 12) h += 12;
    if (mod.includes("am") && h === 12) h = 0;
    if (mod.includes("raat") && h !== 12 && h < 12) h += 12;
    if (mod.includes("subah") && h === 12) h = 0;

    const when = new Date();
    when.setDate(when.getDate() + dayOffset);
    when.setHours(h, minute, 0, 0);

    // If the time already passed today, assume tomorrow.
    if (dayOffset === 0 && when.getTime() <= now.getTime()) {
      when.setDate(when.getDate() + 1);
    }

    // Extract a short description ("to <X>" / before/<time> tokens)
    let what = t
      .replace(/\b(remind me|set a reminder|reminder|yaad dila[no]*|yaad dilana|yaad karo)\b/gi, "")
      .replace(/\b(kal|aaj|parso|subah|shaam|raat)\b/gi, "")
      .replace(/\b(\d{1,2})(\d{2})?\s*(am|pm|baje|baja\b)?\b/gi, "")
      .replace(/\bin\s+\d+\s+\w+\b/gi, "")
      .replace(/[.,;!?]/g, "")
      .trim();
    if (what.startsWith("to ")) what = what.slice(3);
    if (!what) what = "your reminder";

    return { when, what, ok: true };
  }

  /**
   * Schedule a (parsed) reminder. Returns the id, or null on failure.
   */
  function setReminder({ when, what, original }) {
    if (!(when instanceof Date) || isNaN(when.getTime())) return null;

    const item = {
      id: idCounter++,
      when: when.getTime(),
      original: original || "",
      what: what || "your reminder",
    };
    items.push(item);
    schedule(item);
    return item.id;
  }

  /**
   * Convenience: parse + schedule in one call.
   */
  function addFromText(text) {
    const parsed = parse(text);
    if (!parsed.ok || !parsed.when) return { id: null, parsed };
    const id = setReminder(parsed);
    return { id, parsed };
  }

  function schedule(item) {
    const delay = Math.max(0, item.when - Date.now());

    // setTimeout caps at ~24.8 days; chain for longer waits
    const MAX_DELAY = 2147483647;
    const fire = () => {
      if (fireHandler) {
        try {
          fireHandler(item);
        } catch (err) {
          /* keep going */
        }
      }
    };

    if (delay <= MAX_DELAY) {
      timers[item.id] = setTimeout(fire, delay);
    } else {
      // recursively wait until the delay is small enough
      (function chain(remaining) {
        if (remaining <= MAX_DELAY) {
          timers[item.id] = setTimeout(fire, remaining);
        } else {
          timers[item.id] = setTimeout(
            () => chain(remaining - MAX_DELAY),
            MAX_DELAY
          );
        }
      })(delay);
    }
  }

  function cancel(id) {
    items = items.filter((r) => r.id !== id);
    if (timers[id]) {
      clearTimeout(timers[id]);
      delete timers[id];
    }
  }

  function list() {
    return items.slice();
  }

  function clearAll() {
    items.forEach((r) => {
      if (timers[r.id]) clearTimeout(timers[r.id]);
    });
    items = [];
  }

  function isActive() {
    return items.length > 0;
  }

  return {
    setFireHandler,
    parse,
    setReminder,
    addFromText,
    cancel,
    list,
    clearAll,
    isActive,
  };
})();