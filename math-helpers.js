((scope) => {
  "use strict";
  const MAX_ABSOLUTE_NUMBER = 1_000_000_000_000;

  function parseDanishNumber(rawValue) {
    let value = String(rawValue).trim().replace(/\s+/g, "");
    if (!value || !/^[+-]?[0-9.,]+$/.test(value) || !/\d/.test(value)) return null;

    const commaIndex = value.lastIndexOf(",");
    const dotIndex = value.lastIndexOf(".");
    if (commaIndex >= 0 && dotIndex >= 0) {
      const decimalSeparator = commaIndex > dotIndex ? "," : ".";
      const thousandsSeparator = decimalSeparator === "," ? "." : ",";
      const sign = value.startsWith("-") || value.startsWith("+") ? value[0] : "";
      const unsigned = sign ? value.slice(1) : value;
      const decimalParts = unsigned.split(decimalSeparator);
      if (decimalParts.length !== 2 || !decimalParts[0] || !decimalParts[1]) return null;
      const [integerPart, decimalPart] = decimalParts;
      if (decimalPart.includes(thousandsSeparator) || !/^\d+$/.test(decimalPart)) return null;
      const groups = integerPart.split(thousandsSeparator);
      if (
        groups.length < 2 ||
        !/^\d{1,3}$/.test(groups[0]) ||
        !groups.slice(1).every((group) => /^\d{3}$/.test(group))
      ) {
        return null;
      }
      value = `${sign}${groups.join("")}.${decimalPart}`;
    } else {
      const separator = commaIndex >= 0 ? "," : dotIndex >= 0 ? "." : "";
      if (separator) {
        const parts = value.replace(/^[+-]/, "").split(separator);
        if (parts.length > 2) {
          const looksLikeThousands =
            separator === "." &&
            parts[0].length >= 1 &&
            parts[0].length <= 3 &&
            parts.slice(1).every((part) => part.length === 3);
          if (!looksLikeThousands) return null;
          value = value.split(separator).join("");
        } else {
          const looksLikeDanishThousands =
            separator === "." &&
            parts[0] !== "0" &&
            parts[0].length >= 1 &&
            parts[0].length <= 3 &&
            parts[1].length === 3;
          if (looksLikeDanishThousands) return null;
          value = value.replace(separator, ".");
        }
      }
    }

    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isAmbiguousDanishNumber(rawValue) {
    const value = String(rawValue).trim().replace(/\s+/g, "");
    return /^[+-]?[1-9]\d{0,2}\.\d{3}$/.test(value);
  }

  function isSupportedNumber(number) {
    return Number.isFinite(number) && Math.abs(number) <= MAX_ABSOLUTE_NUMBER;
  }

  function decimalDigitsFromInput(rawValue) {
    const value = String(rawValue).trim().replace(/\s+/g, "").replace(/^[+-]/, "");
    const commaIndex = value.lastIndexOf(",");
    const dotIndex = value.lastIndexOf(".");
    if (commaIndex >= 0 && dotIndex >= 0) {
      const decimalIndex = Math.max(commaIndex, dotIndex);
      return value.slice(decimalIndex + 1);
    }
    if (commaIndex >= 0 && value.indexOf(",") === commaIndex) return value.slice(commaIndex + 1);
    if (dotIndex >= 0 && value.indexOf(".") === dotIndex) return value.slice(dotIndex + 1);
    return "";
  }

  const sentenceSegmenter =
    typeof Intl.Segmenter === "function" ? new Intl.Segmenter("da", { granularity: "sentence" }) : null;

  function protectInternalPeriods(text) {
    const marker = "\uE000";
    const withProtectedAbbreviations = text.replace(
      /\b(?:dr|hr|fru|frk|kl|ca|fx|nr|inkl|ekskl|evt|osv|mfl|f\.eks|bl\.a|m\.m)\./giu,
      (match) => match.replaceAll(".", marker)
    );
    return withProtectedAbbreviations.replace(/\./g, (dot, index, source) => {
      const before = source[index - 1] || "";
      const after = source[index + 1] || "";
      return /[\p{L}\d]/u.test(before) && /[\p{L}\d]/u.test(after) ? marker : dot;
    });
  }

  function splitTextIntoSentences(text) {
    const markerPattern = /\uE000/g;
    return String(text)
      .split(/\n+/)
      .flatMap((paragraph) => {
        const protectedParagraph = protectInternalPeriods(paragraph);
        if (sentenceSegmenter) {
          return Array.from(sentenceSegmenter.segment(protectedParagraph), (part) => part.segment);
        }
        return protectedParagraph.match(/[^.!?…]+(?:[.!?…]+|$)/g) || [];
      })
      .map((sentence) => sentence.replace(markerPattern, ".").trim())
      .filter(Boolean);
  }

  function roundSafe(number, precision = 10) {
    if (!Number.isFinite(number)) return number;
    return Number(number.toFixed(precision));
  }

  function formatNumber(number, maximumFractionDigits = 8) {
    if (!Number.isFinite(number)) return "—";
    return new Intl.NumberFormat("da-DK", {
      maximumFractionDigits,
      useGrouping: true
    }).format(roundSafe(number, maximumFractionDigits));
  }

  function formatMoney(number) {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      minimumFractionDigits: Number.isInteger(roundSafe(number, 2)) ? 0 : 2,
      maximumFractionDigits: 2
    }).format(roundSafe(number, 2));
  }

  function operationSymbol(operator) {
    return { "+": "+", "-": "−", "*": "×", "/": "÷" }[operator];
  }

  function calculate(a, b, operator) {
    if (operator === "+") return a + b;
    if (operator === "-") return a - b;
    if (operator === "*") return a * b;
    return a / b;
  }

  function placeParts(number) {
    const absolute = Math.abs(roundSafe(number, 8));
    const fixed = absolute.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
    const [integerPart, decimalPart = ""] = fixed.split(".");
    const parts = [];

    integerPart.split("").forEach((digit, index) => {
      const part = Number(digit) * 10 ** (integerPart.length - index - 1);
      if (part) parts.push(part);
    });
    decimalPart.split("").forEach((digit, index) => {
      const part = Number(digit) / 10 ** (index + 1);
      if (part) parts.push(part);
    });

    return parts.length ? parts : [0];
  }

  function additionOrSubtractionSteps(a, b, operator, result) {
    const isAddition = operator === "+";
    const direction = isAddition ? (b >= 0 ? 1 : -1) : b >= 0 ? -1 : 1;
    const parts = placeParts(b);
    const symbol = direction > 0 ? "+" : "−";
    const steps = [`Start med ${formatNumber(a)}.`];

    if (b < 0) {
      steps.push(
        isAddition
          ? `At lægge ${formatNumber(b)} til svarer til at trække ${formatNumber(Math.abs(b))} fra.`
          : `At trække ${formatNumber(b)} fra svarer til at lægge ${formatNumber(Math.abs(b))} til.`
      );
    }
    if (parts.length > 1) {
      steps.push(`Del ${formatNumber(Math.abs(b))} op i ${parts.map((part) => formatNumber(part)).join(" + ")}.`);
    } else {
      steps.push(
        direction > 0
          ? `Læg ${formatNumber(parts[0])} til.`
          : `Træk ${formatNumber(parts[0])} fra.`
      );
    }

    let running = a;
    parts.forEach((part) => {
      const next = roundSafe(running + direction * part);
      steps.push(`${formatNumber(running)} ${symbol} ${formatNumber(part)} = ${formatNumber(next)}.`);
      running = next;
    });
    steps.push(
      `${formatNumber(a)} ${operationSymbol(operator)} ${formatNumber(b)} giver ${formatNumber(result)}.`
    );
    return steps;
  }

  function calculationSteps(a, b, operator, result) {
    const aText = formatNumber(a);
    const bText = formatNumber(b);
    const resultText = formatNumber(result);

    if (operator === "+" || operator === "-") return additionOrSubtractionSteps(a, b, operator, result);

    if (operator === "*") {
      const steps = [`Start med regnestykket ${aText} × ${bText}.`];
      if (Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b > 0 && b <= 10) {
        steps.push(`${bText} grupper med ${aText} kan skrives som ${Array(b).fill(aText).join(" + ")}.`);
      } else {
        const parts = placeParts(b);
        if (parts.length > 1) {
          steps.push(`Del ${formatNumber(Math.abs(b))} op i ${parts.map((part) => formatNumber(part)).join(" + ")}.`);
          const partialResults = parts.map((part) => roundSafe(Math.abs(a) * part));
          parts.forEach((part, index) => {
            steps.push(
              `${formatNumber(Math.abs(a))} × ${formatNumber(part)} = ${formatNumber(partialResults[index])}.`
            );
          });
          steps.push(`${partialResults.map((part) => formatNumber(part)).join(" + ")} = ${formatNumber(Math.abs(result))}.`);
        } else {
          steps.push(
            `Regn først med tallenes størrelser: ${formatNumber(Math.abs(a))} × ${formatNumber(Math.abs(b))} = ${formatNumber(Math.abs(result))}.`
          );
        }
        if (a === 0 || b === 0) {
          steps.push("Når et af tallene er 0, bliver svaret 0.");
        } else if ((a < 0) === (b < 0)) {
          steps.push("Tallene har samme fortegn, så svaret er positivt.");
        } else {
          steps.push("Tallene har forskelligt fortegn, så svaret er negativt.");
        }
      }
      steps.push(`${aText} × ${bText} giver ${resultText}.`);
      return steps;
    }
    const steps = [`Start med regnestykket ${aText} ÷ ${bText}.`];
    if (a >= 0 && b > 0) {
      steps.push(`Del ${aText} i ${bText} lige store dele.`);
    } else {
      steps.push(
        `Regn først med tallenes størrelser: ${formatNumber(Math.abs(a))} ÷ ${formatNumber(Math.abs(b))} = ${formatNumber(Math.abs(result))}.`
      );
      if (a === 0) {
        steps.push("0 delt med et tal er 0.");
      } else if ((a < 0) === (b < 0)) {
        steps.push("Tallene har samme fortegn, så svaret er positivt.");
      } else {
        steps.push("Tallene har forskelligt fortegn, så svaret er negativt.");
      }
    }
    steps.push(`${aText} ÷ ${bText} giver ${resultText}.`);
    return steps;
  }

  function greatestCommonDivisor(a, b) {
    let first = Math.abs(a);
    let second = Math.abs(b);
    while (second) {
      [first, second] = [second, first % second];
    }
    return first || 1;
  }

  function minutesFromTime(value) {
    if (!/^\d{2}:\d{2}$/.test(value)) return null;
    const [hours, minutes] = value.split(":").map(Number);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function durationText(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const pieces = [];
    if (hours) pieces.push(`${hours} ${hours === 1 ? "time" : "timer"}`);
    if (minutes || !hours) pieces.push(`${minutes} ${minutes === 1 ? "minut" : "minutter"}`);
    return pieces.join(" og ");
  }

  scope.KlarstiMath = Object.freeze({
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
  });
})(globalThis);
