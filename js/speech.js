/* =========================================================
   NARU — Speech Module
   Wraps the Web Speech API (SpeechRecognition + SpeechSynthesis)
   with bilingual (English + Hindi) support.
   ========================================================= */

const NaruSpeech = (() => {
  const SpeechRecognitionAPI =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const isRecognitionSupported = !!SpeechRecognitionAPI;
  const isSynthesisSupported = "speechSynthesis" in window;

  let recognition = null;

  if (isRecognitionSupported) {
    recognition = new SpeechRecognitionAPI();
    recognition.lang = "hi-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
  }

  // ----- voice selection -----
  let voices = [];

  function refreshVoices() {
    if (!isSynthesisSupported) return;
    try {
      voices = window.speechSynthesis.getVoices() || [];
    } catch (err) {
      voices = [];
    }
  }

  if (isSynthesisSupported) {
    refreshVoices();
    try {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    } catch (err) {
      /* not all browsers fire voiceschanged */
    }
  }

  /**
   * Pick the best available voice for a language ("en" | "hi").
   * For Hindi: prefers a hi-IN voice, then any hi, then en-IN.
   */
  function pickVoice(lang) {
    if (!voices.length) return null;

    if (lang === "hi") {
      return (
        voices.find((v) => /^hi[-_]?IN$/i.test(v.lang)) ||
        voices.find((v) => /^hi\b/i.test(v.lang)) ||
        voices.find((v) => /^en[-_]IN$/i.test(v.lang)) ||
        voices.find((v) => /^en/i.test(v.lang)) ||
        null
      );
    }

    return (
      voices.find((v) => /^en[-_]?US$/i.test(v.lang)) ||
      voices.find((v) => /^en\b/i.test(v.lang)) ||
      null
    );
  }

  /**
   * Start listening for a single voice command.
   * @param {Object} handlers
   * @param {"en-US"|"hi-IN"} handlers.lang
   * @param {(text: string) => void} handlers.onResult
   * @param {() => void} handlers.onStart
   * @param {() => void} handlers.onEnd
   * @param {(error: string) => void} handlers.onError
   */
  function listen({ lang = "en-US", onResult, onStart, onEnd, onError } = {}) {
    if (!isRecognitionSupported) {
      onError && onError("Speech recognition is not supported in this browser.");
      return;
    }

    recognition.lang = lang;

    recognition.onstart = () => {
      onStart && onStart();
    };

    recognition.onresult = (event) => {
      const result =
        event.results && event.results[0] && event.results[0][0];
      if (!result || !result.transcript) {
        onError && onError("no-speech");
        return;
      }
      const transcript = result.transcript.trim();
      onResult && onResult(transcript);
    };

    recognition.onerror = (event) => {
      onError && onError(event.error || "Unknown recognition error");
    };

    recognition.onend = () => {
      onEnd && onEnd();
    };

  try {
  recognition.start();
} catch (err) {
  // start() throws if called while already listening
  onError && onError(err.message || "Could not start recognition");
}
    


  function stopListening() {
    if (recognition) {
      recognition.stop();
    }
  }

  /**
   * Speak text aloud using SpeechSynthesis.
   * @param {string} text
   * @param {Object} handlers
   * @param {"en"|"hi"} handlers.lang
   * @param {() => void} handlers.onStart
   * @param {() => void} handlers.onEnd
   */
  function speak(text, { lang = "en", onStart, onEnd } = {}) {
    if (!isSynthesisSupported) {
      onEnd && onEnd();
      return;
    }

    // Cancel anything currently queued/speaking
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "hi" ? "hi-IN" : "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voice = pickVoice(lang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.onstart = () => onStart && onStart();
    utterance.onend = () => onEnd && onEnd();
    utterance.onerror = () => onEnd && onEnd();

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (isSynthesisSupported) {
      window.speechSynthesis.cancel();
    }
  }

  return {
    isRecognitionSupported,
    isSynthesisSupported,
    listen,
    stopListening,
    speak,
    stopSpeaking,
    pickVoice,
  };
})();