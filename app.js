(() => {
  "use strict";

  const STORAGE_KEY = "klarsti-settings-v1";
  const root = document.documentElement;
  const readingStatus = document.querySelector("#reading-status");
  const settingsStatus = document.querySelector("#settings-status");
  const {
    calculate,
    calculationSteps,
    decimalDigitsFromInput,
    durationText,
    formatMoney,
    formatNumber,
    greatestCommonDivisor,
    isAmbiguousDanishNumber,
    isSupportedNumber,
    minutesFromTime,
    operationSymbol,
    parseDanishNumber,
    roundSafe,
    splitTextIntoSentences
  } = window.KlarstiMath;
  const {
    chooseAutomaticVoice,
    isDanishVoice,
    makeNaturalSpeechQueue,
    rankVoices,
    voiceKey
  } = window.KlarstiSpeech;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  let activeRecognition = null;
  let stopSpeechHandler = null;

  const preferredReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const defaultSettings = {
    fontSize: "medium",
    fontFamily: "arial",
    extraLineSpacing: true,
    extraLetterSpacing: false,
    extraWordSpacing: false,
    theme: "cream",
    focusHighlight: true,
    reduceMotion: preferredReducedMotion,
    speechSpeed: 0.9,
    speechVoiceKey: "auto"
  };

  const allowedSettings = {
    fontSize: ["small", "medium", "large"],
    fontFamily: ["arial", "verdana", "system"],
    theme: ["cream", "light", "dark", "contrast"]
  };

  function safeLoadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const next = { ...defaultSettings };

      Object.entries(allowedSettings).forEach(([key, values]) => {
        if (values.includes(saved[key])) next[key] = saved[key];
      });

      ["extraLineSpacing", "extraLetterSpacing", "extraWordSpacing", "focusHighlight", "reduceMotion"].forEach(
        (key) => {
          if (typeof saved[key] === "boolean") next[key] = saved[key];
        }
      );

      if (Number.isFinite(saved.speechSpeed) && saved.speechSpeed >= 0.6 && saved.speechSpeed <= 1.3) {
        next.speechSpeed = saved.speechSpeed;
      }
      if (typeof saved.speechVoiceKey === "string" && saved.speechVoiceKey.length <= 500) {
        next.speechVoiceKey = saved.speechVoiceKey;
      }

      return next;
    } catch {
      return { ...defaultSettings };
    }
  }

  let settings = safeLoadSettings();

  function safeSaveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      return true;
    } catch {
      if (settingsStatus) {
        settingsStatus.textContent =
          "Indstillingerne virker nu, men browseren tillader ikke, at de gemmes til næste gang.";
      }
      return false;
    }
  }

  function speechSpeedDescription(speed) {
    return `${formatNumber(speed)} gange normal hastighed`;
  }

  function applySettings(updateControls = true) {
    const readerSizes = {
      small: "1.15rem",
      medium: "1.35rem",
      large: "1.7rem"
    };
    const readerFonts = {
      arial: "Arial, Helvetica, sans-serif",
      verdana: "Verdana, Geneva, sans-serif",
      system: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    };

    root.dataset.theme = settings.theme;
    root.dataset.focusHighlight = String(settings.focusHighlight);
    root.dataset.reduceMotion = String(settings.reduceMotion);
    root.style.setProperty("--reader-size", readerSizes[settings.fontSize]);
    root.style.setProperty("--reader-font", readerFonts[settings.fontFamily]);
    root.style.setProperty("--reader-leading", settings.extraLineSpacing ? "1.9" : "1.55");
    root.style.setProperty("--reader-letter-spacing", settings.extraLetterSpacing ? "0.055em" : "0");
    root.style.setProperty("--reader-word-spacing", settings.extraWordSpacing ? "0.18em" : "0");

    const themeColor = settings.theme === "dark" || settings.theme === "contrast" ? "#111817" : "#173f3b";
    const metaTheme = $('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", themeColor);

    if (!updateControls) return;

    const fontSizeInput = $(`input[name="font-size"][value="${settings.fontSize}"]`);
    const fontFamilyInput = $(`input[name="font-family"][value="${settings.fontFamily}"]`);
    const themeInput = $(`input[name="theme"][value="${settings.theme}"]`);
    if (fontSizeInput) fontSizeInput.checked = true;
    if (fontFamilyInput) fontFamilyInput.checked = true;
    if (themeInput) themeInput.checked = true;
    $("#line-spacing-toggle").checked = settings.extraLineSpacing;
    $("#letter-spacing-toggle").checked = settings.extraLetterSpacing;
    $("#word-spacing-toggle").checked = settings.extraWordSpacing;
    $("#focus-highlight-toggle").checked = settings.focusHighlight;
    $("#reduce-motion-toggle").checked = settings.reduceMotion;
    $("#speech-speed").value = String(settings.speechSpeed);
    $("#speech-speed-output").textContent = `${formatNumber(settings.speechSpeed)}×`;
    $("#speech-speed").setAttribute("aria-valuetext", speechSpeedDescription(settings.speechSpeed));
    const speechVoiceInput = $("#speech-voice");
    if (speechVoiceInput && [...speechVoiceInput.options].some((option) => option.value === settings.speechVoiceKey)) {
      speechVoiceInput.value = settings.speechVoiceKey;
    }
  }

  function updateSetting(key, value) {
    settings = { ...settings, [key]: value };
    applySettings(false);
    safeSaveSettings();
  }

  $$('input[name="font-size"]').forEach((input) => {
    input.addEventListener("change", () => updateSetting("fontSize", input.value));
  });
  $$('input[name="font-family"]').forEach((input) => {
    input.addEventListener("change", () => updateSetting("fontFamily", input.value));
  });
  $$('input[name="theme"]').forEach((input) => {
    input.addEventListener("change", () => updateSetting("theme", input.value));
  });

  [
    ["#line-spacing-toggle", "extraLineSpacing"],
    ["#letter-spacing-toggle", "extraLetterSpacing"],
    ["#word-spacing-toggle", "extraWordSpacing"],
    ["#focus-highlight-toggle", "focusHighlight"],
    ["#reduce-motion-toggle", "reduceMotion"]
  ].forEach(([selector, key]) => {
    $(selector).addEventListener("change", (event) => updateSetting(key, event.currentTarget.checked));
  });

  $("#reset-settings").addEventListener("click", () => {
    settings = { ...defaultSettings };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Appen fungerer stadig uden lokal lagring.
    }
    applySettings();
    refreshVoices();
    settingsStatus.textContent = "Dine visningsvalg er nulstillet.";
  });

  applySettings();

  const viewTitles = {
    home: "Klarsti – hjælp til ord og tal",
    read: "Læs & skriv – Klarsti",
    numbers: "Tal & regning – Klarsti",
    settings: "Personlig visning – Klarsti"
  };

  function activateView(viewName, moveFocus = true) {
    const wanted = document.querySelector(`[data-view="${viewName}"]`) ? viewName : "home";
    if (wanted !== "read") {
      stopActiveRecognition(true);
      stopSpeechHandler?.(false);
    }
    $$("[data-view]").forEach((view) => {
      view.hidden = view.dataset.view !== wanted;
    });
    $$("[data-nav]").forEach((button) => {
      const active = button.dataset.nav === wanted;
      button.classList.toggle("is-active", active);
      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
    document.title = viewTitles[wanted];
    try {
      history.replaceState(null, "", `#${wanted}`);
    } catch {
      // Nogle browsere begrænser historik på lokale file://-sider.
    }
    window.scrollTo({ top: 0, behavior: settings.reduceMotion ? "auto" : "smooth" });
    if (moveFocus) {
      const heading = $(`[data-view="${wanted}"] h1`);
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }

  $$("[data-nav], [data-go]").forEach((button) => {
    button.addEventListener("click", () => activateView(button.dataset.nav || button.dataset.go));
  });

  const requestedView = location.hash.replace("#", "");
  if (requestedView && document.querySelector(`[data-view="${requestedView}"]`)) {
    activateView(requestedView, false);
  }

  function updateConnectionState() {
    const online = navigator.onLine;
    $("#connection-pill").classList.toggle("is-offline", !online);
    $("#connection-text").textContent = online ? "Online" : "Offline – læsning og regning virker";
  }
  window.addEventListener("online", updateConnectionState);
  window.addEventListener("offline", updateConnectionState);
  updateConnectionState();

  const readingText = $("#reading-text");
  const focusSentence = $("#focus-sentence");
  const sentenceList = $("#sentence-list");
  const sentenceProgress = $("#sentence-progress");
  const previousSentence = $("#previous-sentence");
  const nextSentence = $("#next-sentence");
  const speakSentenceButton = $("#speak-sentence");
  let sentences = [];
  let currentSentenceIndex = 0;

  function splitIntoSentences(text) {
    return splitTextIntoSentences(text);
  }

  function countWords(text) {
    return (text.match(/[\p{L}\p{M}\d]+(?:['’.-][\p{L}\p{M}\d]+)*/gu) || []).length;
  }

  function setCurrentSentence(index, shouldScroll = false, announce = false) {
    if (!sentences.length) {
      currentSentenceIndex = 0;
      focusSentence.textContent = "Din første sætning vises her.";
      sentenceProgress.textContent = "0 af 0";
      previousSentence.disabled = true;
      nextSentence.disabled = true;
      speakSentenceButton.disabled = true;
      return;
    }

    currentSentenceIndex = Math.min(Math.max(index, 0), sentences.length - 1);
    focusSentence.textContent = sentences[currentSentenceIndex];
    sentenceProgress.textContent = `${currentSentenceIndex + 1} af ${sentences.length}`;
    previousSentence.disabled = currentSentenceIndex === 0;
    nextSentence.disabled = currentSentenceIndex === sentences.length - 1;
    speakSentenceButton.disabled = false;

    $$(".sentence-button", sentenceList).forEach((button, buttonIndex) => {
      const active = buttonIndex === currentSentenceIndex;
      button.setAttribute("aria-current", String(active));
      if (active && shouldScroll) button.scrollIntoView({ block: "nearest", behavior: settings.reduceMotion ? "auto" : "smooth" });
    });
    if (announce) {
      readingStatus.textContent = `Sætning ${currentSentenceIndex + 1} af ${sentences.length}: ${sentences[currentSentenceIndex]}`;
    }
  }

  function renderReadingText() {
    const text = readingText.value;
    const words = countWords(text);
    const minutes = Math.max(1, Math.ceil(words / 180));
    $("#word-count").textContent = `${words} ${words === 1 ? "ord" : "ord"}`;
    $("#read-time").textContent =
      words === 0 ? "Under 1 minuts læsning" : `${minutes} ${minutes === 1 ? "minut" : "minutter"}s læsning`;

    const previousSentenceText = sentences[currentSentenceIndex];
    sentences = splitIntoSentences(text);
    sentenceList.replaceChildren();

    if (!sentences.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Skriv tekst i feltet til venstre.";
      sentenceList.append(empty);
      setCurrentSentence(0);
      return;
    }

    sentences.forEach((sentence, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sentence-button";
      button.textContent = sentence;
      button.addEventListener("click", () => setCurrentSentence(index, true));
      sentenceList.append(button);
    });

    const sameSentenceIndex = sentences.indexOf(previousSentenceText);
    setCurrentSentence(sameSentenceIndex >= 0 ? sameSentenceIndex : Math.min(currentSentenceIndex, sentences.length - 1));
  }

  readingText.addEventListener("input", () => {
    undoTextValue = null;
    $("#undo-text").hidden = true;
    renderReadingText();
  });
  previousSentence.addEventListener("click", () => setCurrentSentence(currentSentenceIndex - 1, true, true));
  nextSentence.addEventListener("click", () => setCurrentSentence(currentSentenceIndex + 1, true, true));

  const exampleText =
    "Nogle tekster kan føles som en lang mur. Det hjælper ofte at tage én sætning ad gangen. Du kan også få teksten læst højt. Prøv knapperne og find den måde, der passer bedst til dig.";
  let undoTextValue = null;

  function replaceReadingText(nextText, statusText) {
    stopActiveRecognition(false);
    stopSpeechHandler?.(false);
    if (readingText.value !== nextText) {
      undoTextValue = readingText.value;
      $("#undo-text").hidden = false;
    }
    readingText.value = nextText;
    currentSentenceIndex = 0;
    renderReadingText();
    readingStatus.textContent = statusText;
  }

  $("#load-example").addEventListener("click", () => {
    replaceReadingText(exampleText, "Eksempelteksten er klar. Du kan fortryde ændringen.");
    readingText.focus();
  });

  $("#clean-text").addEventListener("click", () => {
    if (!readingText.value.trim()) {
      readingStatus.textContent = "Der er ingen tekst at rydde op i endnu.";
      return;
    }
    const cleanedText = readingText.value
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (cleanedText === readingText.value) {
      readingStatus.textContent = "Teksten havde ingen ekstra mellemrum.";
      return;
    }
    replaceReadingText(cleanedText, "Ekstra mellemrum er fjernet. Du kan fortryde ændringen.");
  });

  $("#clear-text").addEventListener("click", () => {
    replaceReadingText("", "Tekstfeltet er ryddet. Du kan fortryde ændringen.");
    readingText.focus();
  });

  $("#undo-text").addEventListener("click", () => {
    if (undoTextValue === null) return;
    stopActiveRecognition(false);
    stopSpeechHandler?.(false);
    readingText.value = undoTextValue;
    undoTextValue = null;
    $("#undo-text").hidden = true;
    currentSentenceIndex = 0;
    renderReadingText();
    readingStatus.textContent = "Den seneste tekstændring er fortrudt.";
    readingText.focus();
  });

  $("#copy-text").addEventListener("click", async () => {
    if (!readingText.value) {
      readingStatus.textContent = "Der er ingen tekst at kopiere endnu.";
      return;
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(readingText.value);
      } else {
        readingText.select();
        document.execCommand("copy");
        readingText.setSelectionRange(readingText.value.length, readingText.value.length);
      }
      readingStatus.textContent = "Teksten er kopieret.";
    } catch {
      readingStatus.textContent = "Teksten kunne ikke kopieres. Markér den og vælg Kopiér.";
    }
  });

  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  const voiceSelect = $("#speech-voice");
  const voiceHelp = $("#voice-quality-help");
  const voicePreviewButton = $("#preview-voice");
  let speechRun = 0;
  let currentUtterance = null;
  let speechQueue = [];
  let speechQueueIndex = 0;
  let speechRunConfig = null;
  let speechStartTimer = 0;
  let availableVoices = [];
  let voiceSelectUpdatePending = false;
  let cancellationBarrier = Promise.resolve();

  function configuredVoice(voices = availableVoices) {
    if (settings.speechVoiceKey !== "auto") {
      const savedVoice = voices.find((voice) => voiceKey(voice) === settings.speechVoiceKey);
      if (savedVoice) return savedVoice;
    }
    return chooseAutomaticVoice(voices);
  }

  function voiceOptionLabel(voice) {
    const parts = [voice.name || "Unavngivet stemme", voice.lang || "ukendt sprog"];
    if (voice.localService === true) parts.push("på enheden");
    if (voice.localService === false) parts.push("kan bruge internet");
    if (typeof voice.localService !== "boolean") parts.push("placering ikke oplyst");
    return parts.join(" · ");
  }

  function updateVoiceHelp() {
    if (!synth) {
      voiceHelp.textContent = "Denne browser tilbyder ikke oplæsning.";
      return;
    }
    if (!availableVoices.length) {
      voiceHelp.textContent =
        "Stemmelisten indlæses. Vent et øjeblik, eller åbn appen igen, hvis listen forbliver tom.";
      return;
    }

    const selected = configuredVoice();
    const savedVoiceIsMissing =
      settings.speechVoiceKey !== "auto" &&
      !availableVoices.some((voice) => voiceKey(voice) === settings.speechVoiceKey);

    if (savedVoiceIsMissing) {
      voiceHelp.textContent = selected
        ? `Den gemte stemme findes ikke længere. Klarsti bruger nu ${selected.name}.`
        : "Den gemte stemme findes ikke længere. Enheden vælger dansk standardstemme.";
      return;
    }
    if (!selected) {
      voiceHelp.textContent =
        "Ingen bekræftet lokal dansk stemme blev fundet. Du kan selv vælge en stemme, hvis dens placering er ukendt, eller den kan bruge internet.";
      return;
    }
    if (selected.localService === false) {
      voiceHelp.textContent = `${selected.name} kan bruge internet. Vælg “Bedste lokale danske stemme” for lokal oplæsning.`;
      return;
    }

    const prefix = settings.speechVoiceKey === "auto" ? "Automatisk valgt" : "Valgt";
    const location = selected.localService === true ? " Stemmen er på enheden." : "";
    voiceHelp.textContent = `${prefix}: ${selected.name}.${location}`;
  }

  function populateVoiceSelect() {
    const automaticOption = new Option("Bedste lokale danske stemme", "auto");
    voiceSelect.replaceChildren(automaticOption);

    const danishVoices = availableVoices.filter(isDanishVoice);
    const selectableVoices = danishVoices.length
      ? danishVoices
      : availableVoices.filter((voice) => voice.localService !== false).slice(0, 12);

    if (selectableVoices.length) {
      const group = document.createElement("optgroup");
      group.label = danishVoices.length ? "Danske stemmer" : "Stemmer på enheden";
      selectableVoices.forEach((voice) => {
        group.append(new Option(voiceOptionLabel(voice), voiceKey(voice)));
      });
      voiceSelect.append(group);
    }

    const savedVoiceExists = availableVoices.some((voice) => voiceKey(voice) === settings.speechVoiceKey);
    voiceSelect.value = settings.speechVoiceKey === "auto" || savedVoiceExists ? settings.speechVoiceKey : "auto";
    voiceSelect.disabled = !synth;
    voicePreviewButton.disabled = !synth;
    updateVoiceHelp();
  }

  function refreshVoices() {
    if (!synth) {
      availableVoices = [];
      if (document.activeElement === voiceSelect) {
        voiceSelectUpdatePending = true;
      } else {
        populateVoiceSelect();
      }
      return;
    }
    availableVoices = rankVoices(synth.getVoices());
    if (document.activeElement === voiceSelect) {
      voiceSelectUpdatePending = true;
      return;
    }
    voiceSelectUpdatePending = false;
    populateVoiceSelect();
  }

  if (synth) {
    refreshVoices();
    if (typeof synth.addEventListener === "function") {
      synth.addEventListener("voiceschanged", refreshVoices);
    } else {
      synth.onvoiceschanged = refreshVoices;
    }
  } else {
    populateVoiceSelect();
  }

  function clearSpeechStartTimer() {
    if (!speechStartTimer) return;
    window.clearTimeout(speechStartTimer);
    speechStartTimer = 0;
  }

  function cancelSpeechQueue(previousUtterance) {
    if (!synth) return cancellationBarrier;

    const previousBarrier = cancellationBarrier;
    const hadActiveSpeech = Boolean(
      previousUtterance || synth.speaking || synth.pending || synth.paused
    );
    let currentBarrier = Promise.resolve();

    if (hadActiveSpeech) {
      currentBarrier = new Promise((resolve) => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          window.clearTimeout(timeout);
          resolve();
        };
        const timeout = window.setTimeout(finish, 350);

        if (previousUtterance) {
          previousUtterance.onend = finish;
          previousUtterance.onerror = finish;
        }
      });
    }

    synth.cancel();
    synth.resume();
    cancellationBarrier = Promise.all([previousBarrier, currentBarrier]).then(() => undefined);
    return cancellationBarrier;
  }

  function startSpeechAfterCancellation(thisRun, barrier) {
    barrier.then(() => {
      if (thisRun !== speechRun || !speechRunConfig) return;
      speechStartTimer = window.setTimeout(() => {
        speechStartTimer = 0;
        speakNextChunk(thisRun);
      }, 40);
    });
  }

  function speakNextChunk(thisRun) {
    if (!synth || thisRun !== speechRun || !speechRunConfig) return;
    if (speechQueueIndex >= speechQueue.length) {
      currentUtterance = null;
      readingStatus.textContent = speechRunConfig.completionMessage;
      speechRunConfig = null;
      $("#pause-speech").lastChild.textContent = " Pause";
      return;
    }

    const utterance = new SpeechSynthesisUtterance(speechQueue[speechQueueIndex]);
    currentUtterance = utterance;
    utterance.lang = speechRunConfig.voice?.lang || "da-DK";
    utterance.rate = speechRunConfig.rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (speechRunConfig.voice) utterance.voice = speechRunConfig.voice;
    utterance.onend = () => {
      if (thisRun !== speechRun || currentUtterance !== utterance) return;
      currentUtterance = null;
      speechQueueIndex += 1;
      speakNextChunk(thisRun);
    };
    utterance.onerror = (event) => {
      if (thisRun !== speechRun || currentUtterance !== utterance) return;
      speechQueue = [];
      currentUtterance = null;
      speechRunConfig = null;
      $("#pause-speech").lastChild.textContent = " Pause";
      readingStatus.textContent =
        event.error === "not-allowed"
          ? "Browseren tillod ikke oplæsning. Tryk på Læs højt og prøv igen."
          : "Oplæsningen blev afbrudt. Prøv igen.";
    };
    synth.speak(utterance);
  }

  function speakText(text, options = {}) {
    const cleanText = text.trim();
    if (!cleanText) {
      readingStatus.textContent = "Skriv eller indsæt først den tekst, du vil høre.";
      return;
    }
    if (!synth || !("SpeechSynthesisUtterance" in window)) {
      readingStatus.textContent = "Denne browser kan ikke læse tekst højt. Prøv oplæsning i din enheds tilgængelighedsvalg.";
      return;
    }

    refreshVoices();
    const runVoice = configuredVoice();
    if (!runVoice) {
      stopSpeech(false);
      readingStatus.textContent = availableVoices.length
        ? "Ingen bekræftet lokal dansk stemme er valgt. Vælg selv en stemme i listen, og prøv igen."
        : "Stemmelisten er ikke klar endnu. Vent et øjeblik, åbn eventuelt appen igen, og prøv så igen.";
      return;
    }

    const previousUtterance = currentUtterance;
    speechRun += 1;
    const thisRun = speechRun;
    clearSpeechStartTimer();
    currentUtterance = null;
    const barrier = cancelSpeechQueue(previousUtterance);
    speechQueue = makeNaturalSpeechQueue(cleanText, splitTextIntoSentences);
    speechQueueIndex = 0;
    speechRunConfig = {
      completionMessage: options.completionMessage || "Oplæsningen er færdig.",
      rate: settings.speechSpeed,
      voice: runVoice
    };
    readingStatus.textContent = options.startMessage || "Læser højt …";
    startSpeechAfterCancellation(thisRun, barrier);
  }

  function stopSpeech(showMessage = true) {
    const previousUtterance = currentUtterance;
    speechRun += 1;
    clearSpeechStartTimer();
    currentUtterance = null;
    speechQueue = [];
    speechQueueIndex = 0;
    speechRunConfig = null;
    cancelSpeechQueue(previousUtterance);
    $("#pause-speech").lastChild.textContent = " Pause";
    if (showMessage) readingStatus.textContent = "Oplæsningen er stoppet.";
  }
  stopSpeechHandler = stopSpeech;

  $("#speak-all").addEventListener("click", () => speakText(readingText.value));
  speakSentenceButton.addEventListener("click", () => speakText(sentences[currentSentenceIndex] || ""));
  $("#stop-speech").addEventListener("click", () => stopSpeech());
  $("#pause-speech").addEventListener("click", (event) => {
    if (!synth || (!synth.speaking && !synth.paused)) {
      readingStatus.textContent = "Der er ingen oplæsning at sætte på pause.";
      return;
    }
    if (synth.paused) {
      synth.resume();
      event.currentTarget.lastChild.textContent = " Pause";
      readingStatus.textContent = "Oplæsningen fortsætter.";
    } else {
      synth.pause();
      event.currentTarget.lastChild.textContent = " Fortsæt";
      readingStatus.textContent = "Oplæsningen er sat på pause.";
    }
  });

  $("#speech-speed").addEventListener("input", (event) => {
    const speed = Number(event.currentTarget.value);
    $("#speech-speed-output").textContent = `${formatNumber(speed)}×`;
    event.currentTarget.setAttribute("aria-valuetext", speechSpeedDescription(speed));
  });
  $("#speech-speed").addEventListener("change", (event) => {
    updateSetting("speechSpeed", Number(event.currentTarget.value));
  });
  voiceSelect.addEventListener("change", (event) => {
    stopSpeech(false);
    updateSetting("speechVoiceKey", event.currentTarget.value);
    updateVoiceHelp();
    const selected = configuredVoice();
    readingStatus.textContent = selected
      ? `Stemmen er ændret til ${selected.name}. Tryk på Prøv stemmen for at høre den.`
      : "Ingen bekræftet lokal dansk stemme er klar. Vælg selv en stemme i listen, hvis du vil fortsætte.";
  });
  voiceSelect.addEventListener("blur", () => {
    if (!voiceSelectUpdatePending) return;
    voiceSelectUpdatePending = false;
    populateVoiceSelect();
    const danishVoiceCount = availableVoices.filter(isDanishVoice).length;
    readingStatus.textContent = danishVoiceCount
      ? `${danishVoiceCount} ${danishVoiceCount === 1 ? "dansk stemme er" : "danske stemmer er"} klar i listen.`
      : "Stemmelisten er opdateret, men der blev ikke fundet en dansk stemme.";
  });
  voicePreviewButton.addEventListener("click", () => {
    speakText("Hej. Jeg er Klarstis oplæser. Jeg læser roligt, tydeligt og med naturlige pauser.", {
      completionMessage: "Stemmeprøven er færdig.",
      startMessage: "Afspiller en kort stemmeprøve …"
    });
  });

  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  const dictationButton = $("#start-dictation");

  function stopActiveRecognition(showMessage = true) {
    const recognition = activeRecognition;
    if (!recognition) return false;
    activeRecognition = null;
    try {
      recognition.abort();
    } catch {
      // Genkendelsen kan allerede være stoppet af browseren.
    }
    const button = $("#start-dictation");
    if (button) button.lastChild.textContent = " Diktér";
    if (showMessage) readingStatus.textContent = "Diktering er stoppet.";
    return true;
  }

  dictationButton.addEventListener("click", () => {
    if (!SpeechRecognitionClass) {
      readingStatus.textContent =
        "Diktering er ikke tilgængelig i denne browser. Brug mikrofonen på iPhone- eller iPad-tastaturet.";
      return;
    }

    if (activeRecognition) {
      activeRecognition.stop();
      return;
    }

    const recognition = new SpeechRecognitionClass();
    activeRecognition = recognition;
    let outcomeReported = false;
    recognition.lang = "da-DK";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (activeRecognition !== recognition) return;
      readingStatus.textContent = "Mikrofonen lytter. Tal roligt. Lyden gemmes ikke af Klarsti.";
      dictationButton.lastChild.textContent = " Stop diktering";
    };
    recognition.onresult = (event) => {
      if (activeRecognition !== recognition) return;
      outcomeReported = true;
      const spokenText = event.results[0][0].transcript.trim();
      const space = readingText.value && !/\s$/.test(readingText.value) ? " " : "";
      undoTextValue = readingText.value;
      $("#undo-text").hidden = false;
      readingText.value += `${space}${spokenText}`;
      renderReadingText();
      readingStatus.textContent = "Det talte er sat ind og kan redigeres.";
    };
    recognition.onerror = (event) => {
      if (activeRecognition !== recognition) return;
      outcomeReported = true;
      const errors = {
        "not-allowed": "Mikrofonen fik ikke adgang. Du kan stadig skrive eller bruge mikrofonen på tastaturet.",
        "audio-capture": "Der blev ikke fundet en mikrofon.",
        "no-speech": "Der blev ikke hørt noget. Prøv igen og tal tydeligt.",
        network: "Diktering kræver forbindelse i denne browser. Brug eventuelt mikrofonen på tastaturet."
      };
      readingStatus.textContent = errors[event.error] || "Diktering blev afbrudt. Du kan stadig skrive i tekstfeltet.";
    };
    recognition.onend = () => {
      if (activeRecognition !== recognition) return;
      activeRecognition = null;
      dictationButton.lastChild.textContent = " Diktér";
      if (!outcomeReported && document.visibilityState === "visible") {
        readingStatus.textContent = "Diktering er stoppet.";
      }
    };

    try {
      recognition.start();
    } catch {
      activeRecognition = null;
      readingStatus.textContent = "Diktering kunne ikke starte. Prøv igen.";
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshVoices();
      return;
    }
    const hadRecognition = Boolean(activeRecognition);
    const hadSpeech = Boolean(synth && (synth.speaking || synth.paused || currentUtterance));
    stopActiveRecognition(false);
    stopSpeech(false);
    if (hadRecognition || hadSpeech) {
      readingStatus.textContent = "Oplæsning eller diktering blev stoppet, da appen gik i baggrunden.";
    }
  });

  window.addEventListener("pagehide", () => {
    stopActiveRecognition(false);
    stopSpeech(false);
  });

  renderReadingText();

  const numberTabs = $$("[data-number-tab]");

  function activateNumberTool(toolName, moveFocus = false) {
    numberTabs.forEach((tab) => {
      const active = tab.dataset.numberTab === toolName;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    $$(".number-tool").forEach((tool) => {
      tool.hidden = tool.id !== `number-tool-${toolName}`;
    });
    if (moveFocus) {
      const activePanel = $(`#number-tool-${toolName}`);
      const heading = $("h2", activePanel);
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }

  numberTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateNumberTool(tab.dataset.numberTab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % numberTabs.length;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + numberTabs.length) % numberTabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = numberTabs.length - 1;
      numberTabs[nextIndex].focus();
      activateNumberTool(numberTabs[nextIndex].dataset.numberTab);
    });
  });

  function setInvalid(input, invalid) {
    input.setAttribute("aria-invalid", String(invalid));
  }

  function createStep(number, text) {
    const item = document.createElement("li");
    const badge = document.createElement("span");
    const paragraph = document.createElement("p");
    badge.textContent = String(number);
    paragraph.textContent = text;
    item.append(badge, paragraph);
    return item;
  }

  function runCalculator() {
    const inputA = $("#number-a");
    const inputB = $("#number-b");
    const error = $("#calculator-error");
    const a = parseDanishNumber(inputA.value);
    const b = parseDanishNumber(inputB.value);
    const operator = $("#operator").value;

    $("#calculator-result").hidden = true;
    $("#calculator-announcement").textContent = "";
    setInvalid(inputA, a === null);
    setInvalid(inputB, b === null || (operator === "/" && b === 0));
    error.textContent = "";

    if (a === null || b === null) {
      error.textContent =
        isAmbiguousDanishNumber(inputA.value) || isAmbiguousDanishNumber(inputB.value)
          ? "Et punktum med tre cifre kan betyde to ting. Brug komma til decimaler (1,234) eller skriv tusind uden punktum (1234)."
          : "Skriv et gyldigt tal i begge felter, for eksempel 12 eller 12,5.";
      return;
    }
    if (operator === "/" && b === 0) {
      error.textContent = "Man kan ikke dividere med 0. Vælg et andet tal.";
      return;
    }

    if (!isSupportedNumber(a) || !isSupportedNumber(b)) {
      setInvalid(inputA, !isSupportedNumber(a));
      setInvalid(inputB, !isSupportedNumber(b));
      error.textContent = "Tallet er for stort til at vise tydeligt. Brug højst 1 billion.";
      return;
    }

    const rawResult = calculate(a, b, operator);
    if (!Number.isFinite(rawResult)) {
      error.textContent = "Resultatet er for stort til at vise. Prøv med mindre tal.";
      return;
    }
    const result = roundSafe(rawResult);
    const symbol = operationSymbol(operator);
    const approximate = roundSafe(result, 8) !== result;
    $("#answer-label").textContent = approximate ? "Svaret er cirka" : "Svaret er";
    $("#answer-value").textContent = formatNumber(result);
    $("#answer-equation").textContent =
      `${formatNumber(a)} ${symbol} ${formatNumber(b)} ${approximate ? "≈" : "="} ${formatNumber(result)}`;
    const stepsList = $("#calculation-steps");
    const stepTexts = calculationSteps(a, b, operator, result);
    if (approximate) stepTexts.push("Svaret er afrundet til 8 decimaler.");
    stepsList.replaceChildren(...stepTexts.map((text, index) => createStep(index + 1, text)));
    $("#calculator-result").hidden = false;
    $("#calculator-announcement").textContent =
      `Svar: ${formatNumber(a)} ${symbol} ${formatNumber(b)} er ${approximate ? "cirka " : ""}${formatNumber(result)}.`;
  }

  $("#calculator-form").addEventListener("submit", (event) => {
    event.preventDefault();
    runCalculator();
  });
  $("#operator").addEventListener("change", runCalculator);

  const placeNames = ["enere", "tiere", "hundreder", "tusinder", "titusinder", "hundredtusinder", "millioner"];
  const decimalPlaceNames = ["tiendedele", "hundrededele", "tusindedele"];

  function renderPlaceValue() {
    const input = $("#place-number");
    const error = $("#place-error");
    const grid = $("#place-value-grid");
    const value = parseDanishNumber(input.value);
    grid.replaceChildren();
    $("#place-explanation").textContent = "";
    $("#place-announcement").textContent = "";
    setInvalid(input, value === null);
    error.textContent = "";

    if (value === null) {
      error.textContent = isAmbiguousDanishNumber(input.value)
        ? "Et punktum med tre cifre er uklart. Brug komma til decimaler (1,234) eller skriv tusind uden punktum (1234)."
        : "Skriv et gyldigt tal, for eksempel 1205,34.";
      return;
    }
    const typedDecimalDigits = decimalDigitsFromInput(input.value);
    if (typedDecimalDigits.length > 3) {
      setInvalid(input, true);
      error.textContent = "Pladsværdi viser højst tre decimaler. Skriv tallet med højst tre cifre efter kommaet.";
      return;
    }
    if (Math.abs(value) >= 10000000) {
      setInvalid(input, true);
      error.textContent = "Brug et tal mellem −9.999.999 og 9.999.999, så alle pladser kan vises tydeligt.";
      return;
    }

    const absolute = Math.abs(value);
    const integerPart = String(Math.trunc(absolute));
    const decimalPart = typedDecimalDigits;
    const cards = [];
    const pieces = [];

    integerPart.split("").forEach((digit, index) => {
      const power = integerPart.length - index - 1;
      const name = placeNames[power];
      const placeValue = Number(digit) * 10 ** power;
      cards.push({ digit, name, placeValue });
      pieces.push(`${digit} ${name}`);
    });

    decimalPart.split("").forEach((digit, index) => {
      const name = decimalPlaceNames[index];
      const placeValue = Number(digit) / 10 ** (index + 1);
      cards.push({ digit, name, placeValue });
      pieces.push(`${digit} ${name}`);
    });

    grid.replaceChildren(
      ...cards.map((card) => {
        const element = document.createElement("div");
        element.className = "place-card";
        const label = document.createElement("span");
        const digit = document.createElement("strong");
        const valueLabel = document.createElement("small");
        label.textContent = card.name;
        digit.textContent = card.digit;
        valueLabel.textContent = `værdi: ${formatNumber(card.placeValue, 3)}`;
        element.append(label, digit, valueLabel);
        return element;
      })
    );

    const signText = value < 0 ? "Tallet er negativt. Uden minusset består det af " : "Tallet består af ";
    $("#place-explanation").textContent = `${signText}${pieces.join(", ")}.`;
    $("#place-announcement").textContent = `Tallet er delt op: ${pieces.join(", ")}.`;
  }

  $("#place-form").addEventListener("submit", (event) => {
    event.preventDefault();
    renderPlaceValue();
  });

  function renderFraction() {
    const numeratorInput = $("#numerator");
    const denominatorInput = $("#denominator");
    const error = $("#fraction-error");
    let numerator = parseDanishNumber(numeratorInput.value);
    let denominator = parseDanishNumber(denominatorInput.value);

    $("#fraction-results").hidden = true;
    $("#fraction-visual").hidden = true;
    $("#fraction-announcement").textContent = "";
    setInvalid(numeratorInput, numerator === null);
    setInvalid(denominatorInput, denominator === null || denominator === 0);
    error.textContent = "";

    if (numerator === null || denominator === null) {
      error.textContent = "Skriv et gyldigt tal som tæller og nævner.";
      return;
    }
    if (denominator === 0) {
      error.textContent = "Nævneren kan ikke være 0. Vælg et andet tal.";
      return;
    }
    if (!isSupportedNumber(numerator) || !isSupportedNumber(denominator)) {
      setInvalid(numeratorInput, !isSupportedNumber(numerator));
      setInvalid(denominatorInput, !isSupportedNumber(denominator));
      error.textContent = "Brug mindre tal, så brøken kan vises tydeligt.";
      return;
    }

    if (denominator < 0) {
      numerator *= -1;
      denominator *= -1;
    }

    let displayNumerator = numerator;
    let displayDenominator = denominator;
    if (Number.isInteger(numerator) && Number.isInteger(denominator)) {
      const divisor = greatestCommonDivisor(numerator, denominator);
      displayNumerator = numerator / divisor;
      displayDenominator = denominator / divisor;
    }

    const rawDecimal = numerator / denominator;
    const rawPercent = rawDecimal * 100;
    if (!Number.isFinite(rawDecimal) || !Number.isFinite(rawPercent)) {
      setInvalid(denominatorInput, true);
      error.textContent = "Resultatet er for stort til at vise. Brug en større nævner.";
      return;
    }
    const decimal = roundSafe(rawDecimal);
    const percent = roundSafe(rawPercent);
    const decimalApproximate = roundSafe(decimal, 8) !== decimal;
    const percentApproximate = roundSafe(percent, 4) !== percent;
    $("#fraction-display").textContent = `${formatNumber(displayNumerator)} / ${formatNumber(displayDenominator)}`;
    $("#decimal-display").textContent = `${decimalApproximate ? "≈ " : ""}${formatNumber(decimal)}`;
    $("#percent-display").textContent = `${percentApproximate ? "≈ " : ""}${formatNumber(percent, 4)} %`;

    const fill = $("#fraction-fill");
    fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    const bar = fill.parentElement;
    bar.setAttribute("aria-label", `${percentApproximate ? "Cirka " : ""}${formatNumber(percent, 4)} procent`);

    if (percent < 0) {
      $("#fraction-note").textContent =
        `Delen er negativ og svarer til ${percentApproximate ? "cirka " : ""}${formatNumber(percent, 4)} %.`;
    } else if (percent > 100) {
      $("#fraction-note").textContent =
        `Delen er større end én hel og svarer til ${percentApproximate ? "cirka " : ""}${formatNumber(percent, 4)} %.`;
    } else {
      $("#fraction-note").textContent =
        `Det svarer til ${percentApproximate ? "cirka " : ""}${formatNumber(percent, 4)} ud af 100.`;
    }
    $("#fraction-results").hidden = false;
    $("#fraction-visual").hidden = false;
    $("#fraction-announcement").textContent =
      `${formatNumber(displayNumerator)} divideret med ${formatNumber(displayDenominator)} er ${percentApproximate ? "cirka " : ""}${formatNumber(percent, 4)} procent.`;
  }

  $("#fraction-form").addEventListener("submit", (event) => {
    event.preventDefault();
    renderFraction();
  });

  $("#discount-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const priceInput = $("#discount-price");
    const percentInput = $("#discount-percent");
    const price = parseDanishNumber(priceInput.value);
    const percent = parseDanishNumber(percentInput.value);
    const output = $("#discount-result");
    const invalidPrice = price === null || price < 0 || !isSupportedNumber(price);
    const invalidPercent = percent === null || percent < 0 || percent > 100;
    setInvalid(priceInput, invalidPrice);
    setInvalid(percentInput, invalidPercent);
    if (invalidPrice || invalidPercent) {
      output.textContent = "Skriv en positiv pris og en rabat mellem 0 og 100 procent.";
      return;
    }
    const saving = roundSafe((price * percent) / 100, 2);
    const newPrice = roundSafe(price - saving, 2);
    output.replaceChildren(
      document.createTextNode(`Du sparer ${formatMoney(saving)}. Ny pris: `),
      Object.assign(document.createElement("strong"), { textContent: formatMoney(newPrice) }),
      document.createTextNode(".")
    );
  });

  $("#change-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const totalInput = $("#total-price");
    const paidInput = $("#amount-paid");
    const total = parseDanishNumber(totalInput.value);
    const paid = parseDanishNumber(paidInput.value);
    const output = $("#change-result");
    const invalidTotal = total === null || total < 0 || !isSupportedNumber(total);
    const invalidPaid = paid === null || paid < 0 || !isSupportedNumber(paid);
    setInvalid(totalInput, invalidTotal);
    setInvalid(paidInput, invalidPaid);
    if (invalidTotal || invalidPaid) {
      output.textContent = "Skriv to positive beløb.";
      return;
    }
    const difference = roundSafe(paid - total, 2);
    if (difference < 0) {
      output.replaceChildren(
        document.createTextNode("Du mangler "),
        Object.assign(document.createElement("strong"), { textContent: formatMoney(Math.abs(difference)) }),
        document.createTextNode(".")
      );
    } else {
      output.replaceChildren(
        document.createTextNode("Du skal have "),
        Object.assign(document.createElement("strong"), { textContent: formatMoney(difference) }),
        document.createTextNode(" tilbage.")
      );
    }
  });

  $("#time-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const start = minutesFromTime($("#start-time").value);
    const end = minutesFromTime($("#end-time").value);
    const output = $("#time-result");
    setInvalid($("#start-time"), start === null);
    setInvalid($("#end-time"), end === null);
    if (start === null || end === null) {
      output.textContent = "Vælg både starttid og sluttid.";
      return;
    }
    const crossesMidnight = end < start;
    const difference = crossesMidnight ? 24 * 60 - start + end : end - start;
    output.replaceChildren(
      document.createTextNode("Der er "),
      Object.assign(document.createElement("strong"), { textContent: durationText(difference) }),
      document.createTextNode(crossesMidnight ? " til næste dag." : ".")
    );
  });

  runCalculator();
  renderPlaceValue();
  renderFraction();

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Offline er en forbedring; resten af appen skal altid virke.
      });
    });
  }
})();
