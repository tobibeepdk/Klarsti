((scope) => {
  "use strict";

  const HIGH_QUALITY_WORDS = [
    "enhanced",
    "forbedret",
    "high quality",
    "høj kvalitet",
    "natural",
    "naturlig",
    "neural",
    "premium"
  ];
  const BASIC_QUALITY_WORDS = ["compact", "kompakt", "basic", "espeak"];

  function voiceDescription(voice) {
    return `${voice?.name || ""} ${voice?.voiceURI || ""}`.toLocaleLowerCase("da-DK");
  }

  function voiceKey(voice) {
    if (!voice) return "";
    const uri = String(voice.voiceURI || "").trim();
    if (uri) return `${uri}::${String(voice.lang || "").toLowerCase()}`;
    return `${String(voice.name || "").trim()}::${String(voice.lang || "").toLowerCase()}`;
  }

  function isDanishVoice(voice) {
    return String(voice?.lang || "")
      .toLowerCase()
      .startsWith("da");
  }

  function isLikelyHighQualityVoice(voice) {
    const description = voiceDescription(voice);
    return HIGH_QUALITY_WORDS.some((word) => description.includes(word));
  }

  function voiceQualityScore(voice) {
    const language = String(voice?.lang || "").toLowerCase();
    const description = voiceDescription(voice);
    let score = 0;

    if (language === "da-dk") score += 1000;
    else if (language.startsWith("da")) score += 850;
    if (voice?.localService === true) score += 100;
    if (voice?.localService === false) score -= 100;
    if (isLikelyHighQualityVoice(voice)) score += 140;
    if (voice?.default) score += 25;
    if (BASIC_QUALITY_WORDS.some((word) => description.includes(word))) score -= 80;

    return score;
  }

  function rankVoices(voices) {
    return Array.from(voices || [])
      .map((voice, index) => ({ index, score: voiceQualityScore(voice), voice }))
      .sort((first, second) => {
        if (second.score !== first.score) return second.score - first.score;
        const byName = String(first.voice.name || "").localeCompare(String(second.voice.name || ""), "da");
        return byName || first.index - second.index;
      })
      .map(({ voice }) => voice);
  }

  function chooseAutomaticVoice(voices) {
    const rankedLocalVoices = rankVoices(voices).filter((voice) => voice.localService === true);
    return (
      rankedLocalVoices.find((voice) => String(voice.lang || "").toLowerCase() === "da-dk") ||
      rankedLocalVoices.find(isDanishVoice) ||
      null
    );
  }

  function prepareTextForSpeech(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/(^|\s)&(?=\s|$)/g, "$1og")
      .replace(/(\d)\s*%/g, "$1 procent")
      .replace(/\s+([+])\s+/g, " plus ")
      .replace(/\s*[×]\s*/g, " gange ")
      .replace(/\s*[÷]\s*/g, " divideret med ")
      .replace(/\s+([=])\s+/g, " er lig med ")
      .replace(/[ \t]+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();
  }

  function splitLongChunk(text, maximumLength) {
    if (text.length <= maximumLength) return [text];

    const words = text.split(/\s+/).filter(Boolean);
    const chunks = [];
    let current = "";

    words.forEach((word) => {
      if (word.length > maximumLength) {
        if (current) {
          chunks.push(current);
          current = "";
        }
        for (let index = 0; index < word.length; index += maximumLength) {
          chunks.push(word.slice(index, index + maximumLength));
        }
        return;
      }

      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maximumLength && current) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });

    if (current) chunks.push(current);
    return chunks;
  }

  function groupShortChunks(chunks, maximumLength) {
    const grouped = [];
    let current = "";

    chunks.forEach((chunk) => {
      const candidate = current ? `${current} ${chunk}` : chunk;
      if (candidate.length > maximumLength && current) {
        grouped.push(current);
        current = chunk;
      } else {
        current = candidate;
      }
    });

    if (current) grouped.push(current);
    return grouped;
  }

  function makeNaturalSpeechQueue(text, sentenceSplitter, maximumLength = 280) {
    const paragraphs = String(text || "")
      .replace(/\r\n?/g, "\n")
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    const queue = [];

    paragraphs.forEach((paragraph) => {
      const sentences =
        typeof sentenceSplitter === "function"
          ? sentenceSplitter(paragraph)
          : paragraph.match(/[^.!?…]+(?:[.!?…]+|$)/g) || [paragraph];
      const chunks = sentences
        .map(prepareTextForSpeech)
        .filter(Boolean)
        .flatMap((sentence) => splitLongChunk(sentence, maximumLength));
      queue.push(...groupShortChunks(chunks, maximumLength));
    });

    if (!queue.length) {
      return splitLongChunk(prepareTextForSpeech(text), maximumLength).filter(Boolean);
    }
    return queue;
  }

  scope.KlarstiSpeech = Object.freeze({
    chooseAutomaticVoice,
    isDanishVoice,
    isLikelyHighQualityVoice,
    makeNaturalSpeechQueue,
    prepareTextForSpeech,
    rankVoices,
    voiceKey,
    voiceQualityScore
  });
})(globalThis);
