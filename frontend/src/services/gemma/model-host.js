import {
    AutoProcessor,
    Gemma4ForConditionalGeneration,
    TextStreamer,
    env,
} from '@huggingface/transformers'
import { DEFAULT_GEMMA_MODEL_ID, GEMMA_MODELS } from './models'
import ortWasmLoaderUrl from '@/assets/ort/ort-wasm-simd-threaded.asyncify.mjs?url'
import ortWasmBinaryUrl from '@/assets/ort/ort-wasm-simd-threaded.asyncify.wasm?url'

const SPECIAL_TOKENS = [
    '<eos>',
    '<bos>',
    '<end_of_turn>',
    '<start_of_turn>',
    '<|turn>',
    '<turn|>',
    '<|tool>',
    '<tool|>',
    '<|tool_call>',
    '<tool_call|>',
    '<|tool_response>',
    '<tool_response|>',
    '<|channel>',
    '<channel|>',
    '<|think|>',
    '<|image|>',
    '<|"|>',
]

function stripSpecialTokens(text) {
    return SPECIAL_TOKENS.reduce((value, token) => value.split(token).join(''), text)
}

env.backends.onnx.wasm.wasmPaths = {
    mjs: ortWasmLoaderUrl,
    wasm: ortWasmBinaryUrl,
}

export async function checkGemmaWebGpuSupport() {
    if (!('gpu' in navigator)) {
        return 'WebGPU is not available in this browser. Gemma browser inference requires Chrome or another WebGPU-enabled browser.'
    }

    try {
        const adapter = await navigator.gpu.requestAdapter()
        if (!adapter) {
            return 'WebGPU is enabled, but no compatible GPU adapter was found.'
        }
        if (!adapter.features?.has('shader-f16')) {
            return 'Your GPU does not support f16 shaders, which the Gemma ONNX model requires.'
        }
    } catch (error) {
        return `WebGPU compatibility check failed: ${error instanceof Error ? error.message : String(error)}`
    }

    return null
}

export class GemmaModelHost {
    constructor(onStatus = () => {}) {
        this.model = null
        this.processor = null
        this.loading = false
        this.currentModelId = null
        this.loadingModelId = null
        this.abortController = null
        this.contextLimit = 128000
        this.onStatus = onStatus
    }

    getCurrentModelId() {
        return this.currentModelId || this.loadingModelId
    }

    isLoaded() {
        return Boolean(this.model && this.processor)
    }

    async load(modelId = DEFAULT_GEMMA_MODEL_ID) {
        if (this.model && this.currentModelId === modelId) {
            this.onStatus({ status: 'ready', modelId })
            return
        }

        if (this.loading) return

        if (this.model && this.currentModelId !== modelId) {
            await this.unload()
        }

        const warning = await checkGemmaWebGpuSupport()
        if (warning) {
            this.onStatus({ status: 'error', modelId, error: warning })
            throw new Error(warning)
        }

        const config = GEMMA_MODELS[modelId] || GEMMA_MODELS[DEFAULT_GEMMA_MODEL_ID]
        const fileProgress = new Map()
        let lastReportedProgress = -1

        const progressCallback = (info) => {
            if (info?.status === 'progress' && info.file) {
                fileProgress.set(info.file, info.progress || 0)
                const values = [...fileProgress.values()]
                const progress = Math.round(values.reduce((sum, item) => sum + item, 0) / Math.max(values.length, 1))
                if (progress !== lastReportedProgress) {
                    lastReportedProgress = progress
                    this.onStatus({ status: 'loading', modelId, progress })
                }
            } else if (info?.status === 'done' && info.file) {
                fileProgress.set(info.file, 100)
            } else if (info?.status === 'ready') {
                this.onStatus({ status: 'ready', modelId })
            }
        }

        this.loading = true
        this.loadingModelId = modelId
        this.onStatus({ status: 'loading', modelId, progress: 0 })

        try {
            const [model, processor] = await Promise.all([
                Gemma4ForConditionalGeneration.from_pretrained(config.hfModelId, {
                    dtype: 'q4f16',
                    device: 'webgpu',
                    progress_callback: progressCallback,
                }),
                AutoProcessor.from_pretrained(config.hfModelId),
            ])

            this.model = model
            this.processor = processor
            this.currentModelId = modelId
            this.loadingModelId = null
            this.loading = false
            this.contextLimit = config.contextLimit
            this.onStatus({ status: 'ready', modelId, progress: 100 })
        } catch (error) {
            this.loading = false
            this.loadingModelId = null
            this.onStatus({
                status: 'error',
                modelId,
                error: error instanceof Error ? error.message : String(error),
            })
            throw error
        }
    }

    async unload() {
        this.abort()
        if (this.model?.dispose) {
            await this.model.dispose()
        }
        this.model = null
        this.processor = null
        this.currentModelId = null
        this.loadingModelId = null
        this.loading = false
    }

    abort() {
        if (this.abortController) {
            this.abortController.abort()
            this.abortController = null
        }
    }

    async generateRaw(prompt, options = {}) {
        if (!this.model || !this.processor) {
            throw new Error('Gemma model is not loaded yet.')
        }

        const inputs = this.processor.tokenizer(prompt, {
            add_special_tokens: false,
            return_tensor: 'pt',
        })

        let rawResult = ''
        let insideThinking = false
        let insideToolCall = false

        const streamer = new TextStreamer(this.processor.tokenizer, {
            skip_prompt: true,
            skip_special_tokens: false,
            callback_function: (text) => {
                rawResult += text

                if (text.includes('<|channel>')) {
                    insideThinking = true
                    return
                }
                if (text.includes('<channel|>')) {
                    insideThinking = false
                    return
                }
                if (insideThinking) {
                    const cleanThinking = text.replace(/^thought\n?/, '')
                    if (cleanThinking) options.onThinkingChunk?.(cleanThinking)
                    return
                }

                if (text.includes('<|tool_call>')) insideToolCall = true
                if (text.includes('<tool_call|>') || text.includes('<tool_response|>')) {
                    insideToolCall = false
                    return
                }
                if (insideToolCall || text.includes('<|tool_response>')) return

                const clean = stripSpecialTokens(text)
                if (clean) options.onChunk?.(clean)
            },
        })

        this.abortController = new AbortController()
        try {
            await this.model.generate({
                ...inputs,
                max_new_tokens: options.maxTokens || 1024,
                do_sample: false,
                streamer,
                abort_signal: this.abortController.signal,
            })
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return rawResult
            }
            throw error
        } finally {
            this.abortController = null
        }

        return rawResult
    }

    countTokens(text) {
        if (!this.processor) {
            return Math.ceil(String(text || '').length / 4)
        }
        const { input_ids } = this.processor.tokenizer(text, { add_special_tokens: false })
        return input_ids?.size || Math.ceil(String(text || '').length / 4)
    }
}

let singleton = null

export function getGemmaModelHost(onStatus) {
    if (!singleton) {
        singleton = new GemmaModelHost(onStatus)
    } else if (onStatus) {
        singleton.onStatus = onStatus
    }
    return singleton
}
