export const MODEL_IDS = {
    GEMMA_4_E2B: 'gemma-4-e2b',
    GEMMA_4_E4B: 'gemma-4-e4b',
}

export const GEMMA_MODELS = {
    [MODEL_IDS.GEMMA_4_E2B]: {
        id: MODEL_IDS.GEMMA_4_E2B,
        hfModelId: 'onnx-community/gemma-4-E2B-it-ONNX',
        label: 'Gemma 4 E2B',
        downloadSize: '~500MB',
        contextLimit: 128000,
    },
    [MODEL_IDS.GEMMA_4_E4B]: {
        id: MODEL_IDS.GEMMA_4_E4B,
        hfModelId: 'onnx-community/gemma-4-E4B-it-ONNX',
        label: 'Gemma 4 E4B',
        downloadSize: '~1.5GB',
        contextLimit: 128000,
    },
}

export const DEFAULT_GEMMA_MODEL_ID = MODEL_IDS.GEMMA_4_E2B
export const GEMMA_MODEL_STORAGE_KEY = 'mlfit_gemma_model_id'
export const GEMMA_CHAT_SETTINGS_KEY = 'mlfit_gemma_chat_settings'
