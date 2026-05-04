export const STT_LANGUAGE_CODE = "ko" as const;
export const STT_WASM_LANGUAGE = "korean" as const;
export const STT_SPEECH_RECOGNITION_LANG = "ko-KR" as const;

export function resolveSttLanguageCode() {
  return STT_LANGUAGE_CODE;
}
