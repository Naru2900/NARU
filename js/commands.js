/* =========================================================
   NARU — Command Processor (Actions + Multilingual)
   Matches recognized speech (English, Hinglish, Hindi),
   runs deterministic actions, and returns a reply.
   Anything not matched here falls through to the AI engine.
   ========================================================= */

const NaruCommands = (() => {
  // ---------- text helpers ----------
  const DEVANAGARI_DIGITS = "०१२३४५६७८९";
  const HINDI_WEEKDAYS = [
    "रविवार", "सोमवार", "मंगलवार", "बुधवार",
    "गुरुवार", "शुक्रवार", "शनिवार",
  ];
  const HINDI_MONTHS = [
    "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
    "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
  ];

  const toDevanagariDigits = (s) =>
    String(s).replace(/\d/g, (d) => DEVANAGARI_DIGITS[Number(d)]);

  const nowTimeEn = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const nowTimeHi = () => {
    const d = new Date();
    return `${toDevanagariDigits(d.getHours())}:${toDevanagariDigits(d.getMinutes())}`;
  };

  const nowDateEn = () =>
    new Date().toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

  const nowDateHi = () => {
    const d = new Date();
    return `${HINDI_WEEKDAYS[d.getDay()]}, ${toDevanagariDigits(d.getDate())} ${
      HINDI_MONTHS[d.getMonth()]
    } ${toDevanagariDigits(d.getFullYear())}`;
  };

  // ---------- language detection ----------
  const HINDI_RE = /[\u0900-\u097F]/;

  const HINGLISH_MARKER_RE = new RegExp(
    "\\b(kya|kyun|kyaa|hai|ho|ki|kaun|koun|khol|kholo|khola|chala|chalao|" +
      "chalo|karo|karna|karke|samay|waqt|baje|baji|naam|namaste|namaskar|" +
      "shukriya|dhanyavad|dhanyavaad|gaana|sangeet|batao|aap|tum|" +
      "tumhara|nahi|haan|kahan|theek|kuch|kyu|kab|accha|thik|yaad|dila|" +
      "mujhe|mera|remind)\\b",
    "i"
  );

  function detectLang(text, mode) {
    if (mode === "en") return "en";
    if (mode === "hi") return HINDI_RE.test(text) ? "hi" : "hing";
    if (HINDI_RE.test(text)) return "hi";
    if (HINGLISH_MARKER_RE.test(text)) return "hing";
    return "en";
  }

  function ttsFor(detected) {
    return detected === "en" ? "en" : "hi";
  }

  // ---------- shared reply helper ----------
  const S = {
    pick(lang, en, hing, hi) {
      if (lang === "hi") return hi;
      if (lang === "hing") return hing;
      return en;
    },
  };

  /* ==================================================================
     Command list.
     Each entry: { name, test: {en|hing|hi: [fn(t) -> match|null] },
                   run(text, lang, match) -> { reply, lang } }
     Side-effects happen inside run().
     ================================================================== */
  const commandList = [
  {
    name: "greeting",
    test: {
      en: [(t) => /\b(hello|hi|hey|good morning|good evening)\b/.exec(t)],
      hing: [(t) => /\b(namaste|namaskar|hello|helo|hi|hey|salaam)\b/.exec(t)],
      hi: [(t) => /नमस्ते|नमस्कार|हैलो|हाय/.exec(t)],
    },
    run(text, lang) {
      return {
        lang,
        reply: S.pick(
          lang,
          "Hello! I'm NARU, your personal assistant. How can I help?",
          "Namaste! Main NARU hoon, aapka personal assistant. Boliye, kaise madad karoon?",
          "नमस्ते! मैं NARU हूँ, आपका निजी सहायक। कैसे मदद करूँ?"
        ),
      };
    },
    {
    name: "identity",
    test: {
      en: [(t) => /who are you|your name/.exec(t)],
      hing: [(t) => /who are you|your name|aap koun|tum kaun|koun ho|naam kya/.exec(t)],
      hi: [(t) => /आप कौन|तुम कौन|कौन हो|नाम क्या/.exec(t)],
    },
    run(text, lang) {
      return {
        lang,
        reply: S.pick(
          lang,
          "I am NARU — your Neural Assistant and Responsive Utility, built to help you with everyday tasks.",
          "Main NARU hoon — aapka neural assistant aur responsive utility, jo roz ke kaam mein madad karta hai.",
          "मैं NARU हूँ — आपका न्यूरल असिस्टेंट और रिस्पॉन्सिव यूटिलिटी, जो रोज़ के कामों में मदद करता है।"
        ),
      };
    },
  },
  {
    name: "time",
    test: {
      en: [(t) => /\btime\b/.exec(t)],
      hing: [(t) => /\b(time|samay|waqt|kitne baje|kya time)\b/.exec(t)],
      hi: [(t) => /समय|वक़्त|कितने बजे|टाइम/.exec(t)],
    },
    run(text, lang) {
      return {
        lang,
        reply:
          lang === "hi"
            ? `अभी समय ${nowTimeHi()} है।`
            : lang === "hing"
            ? `Abhi time ${nowTimeEn()} hai.`
            : `The current time is ${nowTimeEn()}.`,
      };
    },
  },
  {
    name: "date",
    test: {
      en: [(t) => /\bdate\b|today/.exec(t)],
      hing: [(t) => /\b(date|tarikh|tarik|aaj kya date)\b/.exec(t)],
      hi: [(t) => /तारीख|दिनांक|आज/.exec(t)],
    },
    run(text, lang) {
      return {
        lang,
        reply:
          lang === "hi"
            ? `आज की तारीख़ ${nowDateHi()} है।`
            : lang === "hing"
            ? `Aaj ki date ${nowDateEn()} hai.`
            : `Today's date is ${nowDateEn()}.`,
      };
    },
  },
{
    name: "set-name",
    test: {
      en: [(t) => /(?:my name is|call me|i am named)\s+([a-z][\w\s]{0,30})/i.exec(t)],
      hing: [(t) => /(?:mera naam|my name)\s+([a-z][\w\s]{0,30})/i.exec(t)],
      hi: [(t) => /मेरा नाम\s+([\u0900-\u097F\s]{1,30})/.exec(t)],
    },
    run(text, lang, m) {
      const name = m && m[1] ? m[1].trim().replace(/\s+/g, " ") : null;
      if (name) NaruMemory.setUserName(name);
      return {
        lang,
        reply: name
          ? S.pick(
              lang,
              `Nice to meet you, ${name}! I'll remember that.`,
              `Namaste ${name}! Aapka naam yaad rakh lunga.`,
              `नमस्ते ${name}! मैं ये याद रखूँगा।`
            )
          : S.pick(
              lang,
              "Okay, I'll remember that.",
              "Theek hai, main yaad rakh lunga.",
              "ठीक है, मैं याद रखूँगा।"
            ),
      };
    },
  },
  {
    name: "ask-name",
    test: {
      en: [(t) => /what(?:'s| is) my name|do you know my name/i.exec(t)],
      hing: [(t) => /mera naam kya|mujhe kya bulate|mera naam/i.exec(t)],
      hi: [(t) => /मेरा नाम क्या/.exec(t)],
    },
    run(text, lang) {
      const known = NaruMemory.isUserKnown();
      const userName = NaruMemory.getUser().name;
      return {
        lang,
        reply: known
          ? S.pick(
              lang,
              `Your name is ${userName}.`,
              `Aapka naam ${userName} hai.`,
              `आपका नाम ${userName} है।`
            )
          : S.pick(
              lang,
              "I don't know your name yet. Tell me, like 'my name is David'.",
              "Mujhe abhi aapka naam nahi pata. Boliye, 'mera naam X hai'.",
              "मुझे अभी आपका नाम नहीं पता। बोलिए, 'मेरा नाम X है'।"
            ),
      };
    },
  },
  {
    name: "open-google",
    test: {
      en: [(t) => /open google|google/.exec(t)],
      hing: [(t) => /google|गूगल|khol|kholo/.exec(t)],
      hi: [(t) => /गूगल/.exec(t)],
    },
    run(text, lang) {
      window.open("https://www.google.com", "_blank");
      return {
        lang,
        reply: S.pick(lang, "Opening Google for you.", "Google khol raha hoon.", "गूगल खोल रहा हूँ।"),
      };
    },
  },
  {
    name: "open-youtube",
    test: {
      en: [(t) => /open youtube|youtube/.exec(t)],
      hing: [(t) => /youtube|यूट्यूब|chalao|chal raha/.exec(t)],
      hi: [(t) => /यूट्यूब/.exec(t)],
    },
    run(text, lang) {
      window.open("https://www.youtube.com", "_blank");
      return {
        lang,
        reply: S.pick(lang, "Opening YouTube for you.", "YouTube chala raha hoon.", "यूट्यूब चला रहा हूँ।"),
      };
    },
  },
{
    name: "music",
    test: {
      en: [(t) => /play (some |a )?music|music play|play song|music chalao/.exec(t)],
      hing: [(t) => /music|music (play|chala|baj)|gaana|gana|sangeet/.exec(t)],
      hi: [(t) => /संगीत|गाना/.exec(t)],
    },
    run(text, lang) {
      if (typeof NaruMusic !== "undefined") NaruMusic.start();
      return {
        lang,
        reply: S.pick(
          lang,
          "Playing some music for you! 🎵 Say 'stop music' to stop.",
          "Music chala raha hoon! 🎵 Stop kehne par band hoga.",
          "संगीत चला रहा हूँ! 🎵 बंद करने के लिए कहिए।"
        ),
      };
    },
  },
  {
    name: "music-stop",
    test: {
      en: [(t) => /stop.{0,14}music|music.{0,6}(stop|band|off)/.exec(t)],
      hing: [(t) => /music.{0,8}(band|stop)|(band|stop).{0,8}music/.exec(t)],
      hi: [(t) => /संगीत बंद|गाना बंद|बंद करो/.exec(t)],
    },
    run(text, lang) {
      if (typeof NaruMusic !== "undefined") NaruMusic.stop();
      return {
        lang,
        reply: S.pick(lang, "Music stopped.", "Music band kar diya.", "संगीत बंद कर दिया।"),
      };
    },
  },
  {
    name: "reminder",
    test: {
      en: [(t) => /(?:remind me|set a reminder|reminder)/i.exec(t)],
      hing: [(t) => /(?:yaad dila|yaad karo|remind|reminder)/i.exec(t)],
      hi: [(t) => /याद दिला/.exec(t)],
    },
    run(text, lang) {
      const res = NaruReminders.addFromText(text);
      if (res.id == null) {
        return {
          lang,
          reply: S.pick(
            lang,
            "Sure! Tell me the time, like 'remind me at 5 pm'.",
            "Boliye kab yaad dilana hai, jaise 'kal 5 baje reminded'.",
            "बोलिए कब याद दिलाना है, जैसे 'कल शाम ५ बजे'।"
          ),
        };
      }
      const when = res.parsed.when;
      const timeEn = when.toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit",
      });
      return {
        lang,
        reply:
          lang === "hi"
            ? `ठीक है, मैं ${timeEn} पर याद दिला दूँगा।`
            : lang === "hing"
            ? `Theek hai, main ${timeEn} par yaad dila dunga.`
            : `Got it — I'll remind you at ${timeEn}.`,
      };
    },
  },
  {
    name: "reminders-list",
    test: {
      en: [(t) => /what reminders|list reminders|my reminders/.exec(t)],
      hing: [(t) => /reminder(?:s)? list|list reminders/.exec(t)],
      hi: [(t) => /मेरे रिमाइंडर/.exec(t)],
    },
    run(text, lang) {
      const list = NaruReminders.list();
      if (!list.length) {
        return {
          lang,
          reply: S.pick(
            lang,
            "You have no reminders set.",
            "Abhi koi reminder nahi hai.",
            "अभी कोई रिमाइंडर नहीं है।"
          ),
        };
      }
      const summary = list
        .map((r) => {
          const d = new Date(r.when);
          return `${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — ${r.what}`;
        })
        .join("; ");
      return {
        lang,
        reply: S.pick(lang, `Your reminders: ${summary}`, `Aapke reminders: ${summary}`, `आपके रिमाइंडर: ${summary}`),
      };
    },
  },
  {
    name: "remember-note",
    test: {
      en: [(t) => /(?:remember that|remember this|take a note)\s+(.+)/i.exec(t)],
      hing: [(t) => /(?:yaad rakh(?:na)?|note kar lo)\s+(.+)/i.exec(t)],
      hi: [(t) => /याद रख(?:ना)?\s+(.+)/.exec(t)],
    },
    run(text, lang, m) {
      const note = m && m[1] ? m[1].trim() : "";
      if (note) NaruMemory.addNote(note);
      return {
        lang,
        reply: note
          ? S.pick(
              lang,
              "Done — I'll remember that.",
              "Ho gaya — main yaad rakhunga.",
              "हो गया — मैं याद रखूँगा।"
            )
          : S.pick(lang, "What should I remember?", "Kya yaad rakhoon?", "क्या याद रखूँ?"),
      };
    },
  },
  {
    name: "list-notes",
    test: {
      en: [(t) => /what (?:do|did) (?:you remember|i tell you to remember)|show (?:my )?notes/.exec(t)],
      hing: [(t) => /mera notes|notes dikha/.exec(t)],
      hi: [(t) => /मेरे नोट्स/.exec(t)],
    },
    run(text, lang) {
      const notes = NaruMemory.getNotes();
      if (!notes.length) {
        return {
          lang,
          reply: S.pick(
            lang,
            "I haven't noted anything down yet.",
            "Maine abhi kuch note nahi kiya.",
            "मैंने अभी कुछ नोट नहीं किया।"
          ),
        };
      }
      const joined = notes.slice(-5).join("; ");
      return {
        lang,
        reply: S.pick(
          lang,
          `Here's what I remember: ${joined}`,
          `Mujhe yeh yaad hai: ${joined}`,
          `मुझे ये याद है: ${joined}`
        ),
      };
    },
  },
  {
    name: "thanks",
    test: {
      en: [(t) => /thank you|thanks/.exec(t)],
      hing: [(t) => /shukriya|dhanyavad|dhanyavaad|thank you|thanks/.exec(t)],
      hi: [(t) => /धन्यवाद|शुक्रिया/.exec(t)],
    },
    run(text, lang) {
      return {
        lang,
        reply: S.pick(
          lang,
          "You're welcome! Happy to help.",
          "Aapka swagat hai! Madad karke khushi hui.",
          "आपका स्वागत है! मदद करके खुशी हुई।"
        ),
      };
    },
  },
  {
    name: "how-are-you",
    test: {
      en: [(t) => /how are you/.exec(t)],
      hing: [(t) => /kaise ho|kaisi ho|kya haal|kaise/.exec(t)],
      hi: [(t) => /कैसे हो|कैसे हैं|क्या हाल/.exec(t)],
    },
    run(text, lang) {
      return {
        lang,
        reply: S.pick(
          lang,
          "I'm running at full capacity and ready to assist you! How are you doing?",
          "Main bilkul theek hoon! Aap kaise ho?",
          "मैं बिल्कुल ठीक हूँ और आपकी मदद के लिए तैयार! आप कैसे हैं?"
        ),
      };
    },
  },
{
    name: "open-github",
    test: {
      en: [(t) => /open github|github/.exec(t)],
      hing: [(t) => /github|गिटहब/.exec(t)],
      hi: [(t) => /गिटहब/.exec(t)],
    },
    run(text, lang) {
      window.open("https://www.github.com", "_blank");
      return {
        lang,
        reply: S.pick(lang, "Opening GitHub for you.", "GitHub khol raha hoon.", "गिटहब खोल रहा हूँ।"),
      };
    },
  },
  {
    name: "search",
    test: {
      en: [(t) => /(?:^|\s)(?:search|search the web|google it)(?:\s+for)?\s*(.*)?$/i.exec(t)],
      hing: [(t) => /(?:search|khoj|khojo|google)(?:\s+(?:karo|kar|kijiye))?\s*(.*)?$/i.exec(t)],
      hi: [(t) => /खोज(?:ना)?\s*(.*)?$/.exec(t)],
    },
    run(text, lang, m) {
      const raw = (m && m[1] ? m[1] : "").trim();
      const query = raw || "web search";
      window.open("https://duckduckgo.com/?q=" + encodeURIComponent(query), "_blank");
      return {
        lang,
        reply:
          lang === "hi"
            ? `मैंने "${raw}" की खोज शुरू की है।`
            : lang === "hing"
            ? `Maine "${raw}" khoj shuru kar diya hai.`
            : raw
            ? `Searching the web for "${raw}".`
            : "What would you like me to search for?",
      };
    },
  },
];

  /**
   * Process a transcript into a command result or fall through to AI.
   * @param {string} rawText
   * @param {"auto"|"en"|"hi"} mode
   * @returns {{ text: string, lang: "en"|"hi", handled: boolean }}
   */
  function process(rawText, mode = "auto") {
    const text = String(rawText || "").toLowerCase().trim();
    const lang = detectLang(text, mode);

    if (!text) {
      return {
        reply: S.pick(
          lang,
          "I didn't catch that. Could you please repeat?",
          "Kripya dobara boliye, mujhe sunai nahi diya.",
          "माफ़ कीजिए, मुझे सुनाई नहीं दिया। कृपया दोबारा बोलिए।"
        ),
        lang: ttsFor(lang),
        handled: false,
      };
    }

    for (const command of commandList) {
      const tests = command.test[lang] || command.test.en || command.test.hing;
      let match = null;
      for (const test of tests) {
        match = test(text);
        if (match) break;
      }
      if (match) {
        let result;
        try {
          result = command.run(text, lang, match);
        } catch (err) {
          result = {
            lang,
            reply: S.pick(
              lang,
              "That action failed. Please try again.",
              "Yeh action fail ho gaya. Dobara try kijiye.",
              "यह कार्य विफल हुआ। कृपया दोबारा प्रयास करें।"
            ),
          };
        }
        return {
          reply: result ? result.reply : "",
          lang: ttsFor(lang),
          handled: true,
        };
      }
    }

    // Not a deterministic command — conversation goes to the AI engine.
    return { reply: "", lang: ttsFor(lang), handled: false };
  }

  return { process, detectLang, ttsFor };
})();
