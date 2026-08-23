/* =========================================================
   NARU — Main Controller (Conversational)
   Orchestrates voice & text input -> commands/AI -> voice,
   keeps the transcript, and drives the listening loop.
   ========================================================= */

const NaruMain = (() => {
  // ---------- DOM references ----------
  const micBtn = document.getElementById("micBtn");
  const core = document.getElementById("core");
  const statusLine = document.getElementById("statusLine");
  const hint = document.getElementById("hint");
  const chatLog = document.getElementById("chatLog");
  const textInput = document.getElementById("textInput");
  const sendBtn = document.getElementById("sendBtn");
  const clearBtn = document.getElementById("clearBtn");
  const continuousToggle = document.getElementById("continuousToggle");
  const langButtons = document.querySelectorAll(".lang-select button");

  // ---------- State ----------
  let mode = NaruSettings.get("langMode") || "auto"; // auto | en | hi
  let isListening = false;
  let isProcessing = false;

  const RECOG_LANG = { auto: "hi-IN", en: "en-US", hi: "hi-IN" };
  const HINTS = {
    auto: "बोलिए / Speak — Hindi, Hinglish, or English",
    en: "Tap the mic and speak, or type below",
    hi: "माइक दबाकर बोलिए, या नीचे लिखिए",
  };

  const ttsLangValue = (lang) => (lang === "en" ? "en" : "hi");

  // ---------- UI helpers ----------
  function setStatus(text, state) {
    statusLine.textContent = text;
    statusLine.className = "status-line" + (state ? " " + state : "");
  }

  function setListeningUI(on) {
    isListening = on;
    micBtn.classList.toggle("listening", on);
    core.classList.toggle("active", on);
  }

  function setMode(newMode) {
    mode = newMode;
    NaruSettings.set("langMode", newMode);
    langButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === mode);
    });
    hint.textContent = HINTS[mode];
  }

  function addChat(role, text) {
    const row = document.createElement("div");
    row.className = "chat-msg " + role;
    const label = document.createElement("span");
    label.className = "chat-label";
    label.textContent = role === "user" ? "YOU" : "NARU";
    const body = document.createElement("p");
    body.className = "chat-text";
    body.textContent = text;
    row.appendChild(label);
    row.appendChild(body);
    chatLog.appendChild(row);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // ---------- Speech recognition handlers ----------
  function onStart() {
    setListeningUI(true);
    setStatus("LISTENING…", "listening");
    hint.textContent = mode === "hi" ? "सुन रहा हूँ… बोलिए" : "Listening… speak now";
  }

  function onResult(transcript) {
    if (isProcessing) return;
    setListeningUI(false);
    setStatus("THINKING…", "");
    processUserInput(transcript);
  }

  function onError(error) {
    setListeningUI(false);
    const errorKey = error.toLowerCase();
    setStatus(`ERROR — ${errorKey.toUpperCase()}`, "error");
    hint.textContent = HINTS[mode];

    if (errorKey === "no-speech") {
      addChat(
        "naru",
        "I didn't hear anything. Please try speaking again. / मुझे कुछ सुनाई नहीं दिया, कृपया दोबारा बोलें।"
      );
    } else if (errorKey === "not-allowed") {
      addChat(
        "naru",
        "Microphone access is blocked. Please allow access in your browser settings, then tap the mic again."
      );
    } else if (errorKey === "service-not-allowed") {
      addChat(
        "naru",
        "Voice service is unavailable in this region right now. You can still type below."
      );
    } else {
      addChat("naru", `Voice recognition error: ${error}. Please try again.`);
    }

    setTimeout(() => {
      if (!isListening && !isProcessing) setStatus("SYSTEM STANDBY", "");
    }, 3000);
  }

  function onEnd() {
    setListeningUI(false);
    if (!isProcessing && !statusLine.classList.contains("error")) {
      setStatus("SYSTEM STANDBY", "");
    }
  }

  // ---------- Conversation pipeline ----------
  function offlineMessage(spoken) {
    if (spoken === "hi") {
      return "मैं अभी अपने AI दिमाग़ (Ollama) से कनेक्ट नहीं कर पा रहा। कृपया Ollama चालू करें और दोबारा पूछें।";
    }
    if (spoken === "hing") {
      return "Main abhi apne AI brain (Ollama) se connect nahi kar pa raha. Kripya Ollama chalu karein aur dobara poochein.";
    }
    return "I can't connect to my AI brain (Ollama) right now. Please start Ollama and ask again.";
  }
async function runPipeline(userText) {
    // 1) Deterministic commands/actions first.
    const commandResult = NaruCommands.process(userText, mode);
    if (commandResult.handled) {
      return { text: commandResult.reply, lang: commandResult.lang };
    }

    // 2) Otherwise ask the AI engine (local Ollama by default).
    const spoken = NaruCommands.detectLang(userText, mode);
    const aiLang = ttsLangValue(spoken);
    const history = NaruMemory.getRecent(12);
    const messages = NaruAI.buildMessages(userText, history, spoken);

    let aiText;
    try {
      aiText = await NaruAI.chat(messages);
    } catch (err) {
      return { text: offlineMessage(spoken), lang: aiLang, offline: true };
    }
    if (!aiText || !aiText.trim()) {
      return { text: offlineMessage(spoken), lang: aiLang, offline: true };
    }
    return { text: aiText.trim(), lang: aiLang };
  }

  function speakReply(text, lang) {
    NaruSpeech.speak(text, {
      lang: lang,
      onStart: () => {
        setStatus("SPEAKING…", "speaking");
        core.classList.add("speaking");
      },
      onEnd: () => {
        core.classList.remove("speaking");
        isProcessing = false;
        if (!isListening && !statusLine.classList.contains("error")) {
          setStatus("SYSTEM STANDBY", "");
        }
        maybeContinueListening();
      },
    });
  }

  function maybeContinueListening() {
    const cont = NaruSettings.get("continuous");
    if (!cont || isListening || isProcessing) return;
    setTimeout(() => {
      if (!isListening && !isProcessing) beginListening();
    }, 500);
  }

  function processUserInput(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed || isProcessing) return;

    isProcessing = true;
    setStatus("THINKING…", "");
    NaruMemory.add("user", trimmed);
    addChat("user", trimmed);
    if (textInput) textInput.value = "";

    runPipeline(trimmed)
      .then((res) => {
        NaruMemory.add("assistant", res.text);
        addChat("naru", res.text);
        speakReply(res.text, res.lang);
      })
      .catch(() => {
        const spoken = NaruCommands.detectLang(trimmed, mode);
        const text = offlineMessage(spoken);
        NaruMemory.add("assistant", text);
        addChat("naru", text);
        setStatus("ERROR — AI", "error");
        isProcessing = false;
        setTimeout(() => setStatus("SYSTEM STANDBY", ""), 2500);
      });
  }
// ---------- Listening controls ----------
  function beginListening() {
    if (isListening || isProcessing) return;
    NaruSpeech.listen({
      lang: RECOG_LANG[mode],
      onStart,
      onResult,
      onError,
      onEnd,
    });
  }

  function toggleListening() {
    if (isListening) {
      NaruSpeech.stopListening();
      setListeningUI(false);
      setStatus("SYSTEM STANDBY", "");
      return;
    }
    beginListening();
  }

  // ---------- Reminders wiring ----------
  function onReminderFire(item) {
    const msg = "⏰ Reminder: " + item.what;
    addChat("naru", msg);
    NaruMemory.add("assistant", msg);
    NaruSpeech.speak("Reminder. " + item.what, { lang: "en" });
  }

  // ---------- Init ----------
  function init() {
    // Language selector
    langButtons.forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.lang));
    });
    setMode(mode);

    // Continuous conversation toggle
    if (continuousToggle) {
      continuousToggle.checked = !!NaruSettings.get("continuous");
      continuousToggle.addEventListener("change", () => {
        NaruSettings.set("continuous", continuousToggle.checked);
        hint.textContent = continuousToggle.checked
          ? "Continuous mode ON — I'll keep listening after I reply"
          : HINTS[mode];
      });
    }

    // Text conversation
    sendBtn && sendBtn.addEventListener("click", () => processUserInput(textInput.value));
    textInput &&
      textInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") processUserInput(textInput.value);
      });

    // Clear conversation
    clearBtn &&
      clearBtn.addEventListener("click", () => {
        NaruMemory.clear();
        chatLog.innerHTML = "";
        setStatus("SYSTEM STANDBY", "");
        hint.textContent = HINTS[mode];
      });

    // Mic
    micBtn.addEventListener("click", toggleListening);

    // Reminders speak through NARU
    NaruReminders.setFireHandler(onReminderFire);

    if (!NaruSpeech.isRecognitionSupported) {
      micBtn.classList.add("disabled");
      setStatus("SPEECH NOT SUPPORTED", "error");
      hint.textContent = "Voice input unavailable — text still works";
      return;
    }

    // Welcome bubble
    addChat(
      "naru",
      "Hello! I'm NARU. Tap the mic or type below — I can chat, tell time, open websites, set reminders, search the web, and more."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();