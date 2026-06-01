import { Agent } from '@kessler/gemma-agent'
import { buildSystemPrompt } from './help-context'
import { createGemmaTools } from './tools'
import { DEFAULT_GEMMA_MODEL_ID, GEMMA_MODEL_STORAGE_KEY } from './models'

const noopLogger = {
    debug: () => {},
    info: () => {},
    warn: (...args) => console.warn('[Gemma assistant]', ...args),
    error: (...args) => console.error('[Gemma assistant]', ...args),
}

export class GemmaAgentService {
    constructor(settings, callbacks = {}) {
        this.settings = settings
        this.callbacks = callbacks
        this.modelHost = null
        this.agent = null
        this.modelId = localStorage.getItem(GEMMA_MODEL_STORAGE_KEY) || DEFAULT_GEMMA_MODEL_ID
        this.settingsOptions = {
            thinking: true,
            maxIterations: 6,
        }
        this.lastContext = {}
    }

    setCallbacks(callbacks = {}) {
        this.callbacks = callbacks
        if (this.modelHost) {
            this.modelHost.onStatus = (status) => this.callbacks.onStatus?.(status)
        }
    }

    async ensureModelHost() {
        if (!this.modelHost) {
            const { getGemmaModelHost } = await import('./model-host')
            this.modelHost = getGemmaModelHost((status) => this.callbacks.onStatus?.(status))
        }
        return this.modelHost
    }

    async load(modelId = this.modelId) {
        this.modelId = modelId
        localStorage.setItem(GEMMA_MODEL_STORAGE_KEY, modelId)
        const modelHost = await this.ensureModelHost()
        await modelHost.load(modelId)
    }

    async switchModel(modelId) {
        this.clear()
        const modelHost = await this.ensureModelHost()
        await modelHost.unload()
        await this.load(modelId)
    }

    abort() {
        this.modelHost?.abort()
        this.agent?.abort()
    }

    clear() {
        this.agent?.clearHistory()
        this.agent = null
    }

    async ensureAgent(extraContext = {}) {
        const modelHost = await this.ensureModelHost()
        this.lastContext = extraContext
        const systemPrompt = buildSystemPrompt(this.settings, extraContext)
        this.agent = new Agent({
            model: modelHost,
            systemPrompt,
            tools: createGemmaTools(this.settings),
            thinking: this.settingsOptions.thinking,
            maxIterations: this.settingsOptions.maxIterations,
            logger: noopLogger,
            onChunk: (text) => this.callbacks.onChunk?.(text),
            onThinkingChunk: (text) => this.callbacks.onThinking?.(text),
            onToolCall: (call) => this.callbacks.onToolCall?.(call),
            onToolResponse: (response) => this.callbacks.onToolResponse?.(response),
        })
        return this.agent
    }

    updateOptions(options = {}) {
        this.settingsOptions = { ...this.settingsOptions, ...options }
        this.agent?.updateOptions({
            thinking: this.settingsOptions.thinking,
            maxIterations: this.settingsOptions.maxIterations,
        })
    }

    async run(message, options = {}) {
        const modelHost = await this.ensureModelHost()
        if (!modelHost.isLoaded()) {
            await this.load(options.modelId || this.modelId)
        }

        const agent = await this.ensureAgent(options.context || this.lastContext)
        const result = await agent.run(message)
        return result.response
    }
}

let singleton = null

export function getGemmaAgentService(settings, callbacks) {
    if (!singleton) {
        singleton = new GemmaAgentService(settings, callbacks)
    } else {
        singleton.settings = settings
        singleton.setCallbacks(callbacks)
    }
    return singleton
}
