export const DEFAULT_LANGUAGE = "en";
export const SUPPORTED_LANGUAGES = ["en", "hi", "mr"];

export function getLanguageConfig(language = DEFAULT_LANGUAGE) {
  switch (language) {
    case "hi":
      return {
        code: "hi",
        label: "Hindi",
        answerMissing: "मुझे दिए गए दस्तावेज़ में इसका उत्तर नहीं मिला।",
      };
    case "mr":
      return {
        code: "mr",
        label: "Marathi",
        answerMissing: "मला दिलेल्या दस्तावेजात याचे उत्तर सापडले नाही.",
      };
    case "en":
    default:
      return {
        code: "en",
        label: "English",
        answerMissing: "I could not find the answer in the provided document.",
      };
  }
}

export function normalizeLanguage(language) {
  const normalized = typeof language === "string" ? language.trim().toLowerCase() : "";
  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : DEFAULT_LANGUAGE;
}
