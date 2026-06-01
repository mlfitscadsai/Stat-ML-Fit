export const GEMMA_ASSISTANT_OPEN_EVENT = 'mlfit:gemma-assistant-open'

export function openGemmaAssistant(detail = {}) {
    window.dispatchEvent(new CustomEvent(GEMMA_ASSISTANT_OPEN_EVENT, { detail }))
}
