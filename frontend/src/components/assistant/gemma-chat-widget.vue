<template>
    <div class="gemma-assistant" :class="{ 'gemma-assistant--open': isOpen }">
        <button v-if="!isOpen" class="gemma-fab" type="button" @click="openPanel()">
            <span class="gemma-fab__spark">G</span>
            <span>Ask Gemma</span>
        </button>

        <section v-else class="gemma-panel" aria-label="Gemma assistant">
            <header class="gemma-panel__header">
                <div>
                    <p class="gemma-panel__eyebrow">Local AI assistant</p>
                    <h3>Gemma Help</h3>
                </div>
                <div class="gemma-panel__actions">
                    <button type="button" title="Clear chat" @click="clearChat()">
                        <i class="fas fa-eraser"></i>
                    </button>
                    <button type="button" title="Close" @click="isOpen = false">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </header>

            <div class="gemma-status" :class="`gemma-status--${modelStatus.status}`">
                <span>{{ statusLabel }}</span>
                <strong v-if="modelStatus.progress != null && modelStatus.status === 'loading'">
                    {{ modelStatus.progress }}%
                </strong>
            </div>

            <div class="gemma-settings">
                <label>
                    Model
                    <select v-model="selectedModelId" :disabled="busy || modelStatus.status === 'loading'" @change="switchModel()">
                        <option v-for="model in modelOptions" :key="model.id" :value="model.id">
                            {{ model.label }} {{ model.downloadSize }}
                        </option>
                    </select>
                </label>
                <label class="gemma-toggle">
                    <input type="checkbox" v-model="chatSettings.thinking" @change="saveSettings()" />
                    Thinking
                </label>
            </div>

            <div ref="messagesEl" class="gemma-messages">
                <article v-for="message in messages" :key="message.id" class="gemma-message" :class="`gemma-message--${message.role}`">
                    <div v-if="message.role === 'assistant'" v-html="renderMarkdown(message.content)"></div>
                    <p v-else>{{ message.content }}</p>
                </article>
                <article v-if="thinkingText" class="gemma-message gemma-message--thinking">
                    {{ thinkingText }}
                </article>
                <article v-if="toolEvents.length" class="gemma-tool-log">
                    <p v-for="event in toolEvents.slice(-3)" :key="event.id">
                        {{ event.label }}
                    </p>
                </article>
            </div>

            <div v-if="pendingActions.length" class="gemma-actions">
                <article v-for="action in pendingActions" :key="action.id" class="gemma-action-card">
                    <strong>{{ action.title }}</strong>
                    <span>{{ describeAction(action) }}</span>
                    <div class="gemma-action-card__buttons">
                        <button type="button" @click="approveAction(action)">Approve</button>
                        <button type="button" @click="dismissAction(action)">Dismiss</button>
                    </div>
                </article>
            </div>

            <div v-if="messages.length <= 1" class="gemma-suggestions">
                <button v-for="suggestion in suggestions" :key="suggestion" type="button" @click="sendMessage(suggestion)">
                    {{ suggestion }}
                </button>
            </div>

            <form class="gemma-input" @submit.prevent="sendMessage()">
                <textarea
                    v-model="draft"
                    rows="2"
                    :disabled="busy"
                    placeholder="Ask about your dataset, model, diagnostics, or app workflow..."
                    @keydown.enter.exact.prevent="sendMessage()"
                ></textarea>
                <button v-if="busy" type="button" class="gemma-stop" @click="stopGeneration()">
                    Stop
                </button>
                <button v-else type="submit" :disabled="!draft.trim()">
                    Send
                </button>
            </form>
        </section>
    </div>
</template>

<script>
import { marked } from 'marked'
import { settingStore } from '@/stores/settings'
import { getGemmaAgentService } from '@/services/gemma/agent-service'
import { GEMMA_CHAT_SETTINGS_KEY, GEMMA_MODELS, DEFAULT_GEMMA_MODEL_ID } from '@/services/gemma/models'
import { GEMMA_ASSISTANT_OPEN_EVENT } from '@/services/gemma/assistant-events'

marked.setOptions({ breaks: true })

export default {
    name: 'GemmaChatWidget',
    setup() {
        const settings = settingStore()
        return { settings }
    },
    data() {
        return {
            isOpen: false,
            draft: '',
            busy: false,
            selectedModelId: localStorage.getItem('mlfit_gemma_model_id') || DEFAULT_GEMMA_MODEL_ID,
            modelStatus: {
                status: 'idle',
                progress: null,
                error: '',
            },
            messages: [
                {
                    id: 'welcome',
                    role: 'assistant',
                    content: 'Hi, I am Gemma. I can explain your ML workflow, inspect app context, compare results, and open app tabs for you.',
                },
            ],
            thinkingText: '',
            toolEvents: [],
            chatSettings: this.loadSettings(),
            pendingContext: {},
        }
    },
    computed: {
        modelOptions() {
            return Object.values(GEMMA_MODELS)
        },
        suggestions() {
            return [
                'Explain the current dataset and what I should check first.',
                'Compare my latest model results and suggest next steps.',
                'Open model training and guide me through choosing a model.',
            ]
        },
        pendingActions() {
            return (this.settings.pendingAssistantActions || []).filter((action) => action.status === 'pending')
        },
        statusLabel() {
            if (this.modelStatus.status === 'loading') return 'Loading Gemma locally'
            if (this.modelStatus.status === 'ready') return 'Gemma ready in browser'
            if (this.modelStatus.status === 'error') return this.modelStatus.error || 'Gemma unavailable'
            return 'Model loads when you send the first message'
        },
    },
    created() {
        this.agent = getGemmaAgentService(this.settings, this.serviceCallbacks())
        window.addEventListener(GEMMA_ASSISTANT_OPEN_EVENT, this.handleOpenEvent)
    },
    beforeUnmount() {
        window.removeEventListener(GEMMA_ASSISTANT_OPEN_EVENT, this.handleOpenEvent)
    },
    methods: {
        loadSettings() {
            try {
                return {
                    thinking: true,
                    maxIterations: 6,
                    ...JSON.parse(localStorage.getItem(GEMMA_CHAT_SETTINGS_KEY) || '{}'),
                }
            } catch {
                return { thinking: true, maxIterations: 6 }
            }
        },
        saveSettings() {
            localStorage.setItem(GEMMA_CHAT_SETTINGS_KEY, JSON.stringify(this.chatSettings))
            this.agent?.updateOptions(this.chatSettings)
        },
        serviceCallbacks() {
            return {
                onStatus: (status) => {
                    this.modelStatus = {
                        status: status.status,
                        progress: status.progress,
                        error: status.error || '',
                    }
                },
                onChunk: (chunk) => {
                    const current = this.messages[this.messages.length - 1]
                    if (current?.role === 'assistant' && current.streaming) {
                        current.content += chunk
                    }
                    this.scrollToBottom()
                },
                onThinking: (chunk) => {
                    this.thinkingText = `${this.thinkingText}${chunk}`.slice(-600)
                },
                onToolCall: (call) => {
                    this.toolEvents.push({
                        id: `${Date.now()}-${Math.random()}`,
                        label: `Using tool: ${call.name}`,
                    })
                },
                onToolResponse: (response) => {
                    this.toolEvents.push({
                        id: `${Date.now()}-${Math.random()}`,
                        label: `Tool finished: ${response.name}`,
                    })
                },
            }
        },
        openPanel() {
            this.isOpen = true
            this.$nextTick(this.scrollToBottom)
        },
        handleOpenEvent(event) {
            this.openPanel()
            const detail = event.detail || {}
            this.pendingContext = detail.context || {}
            if (detail.prompt) {
                this.$nextTick(() => this.sendMessage(detail.prompt, detail.context || {}))
            }
        },
        renderMarkdown(content) {
            return marked.parse(content || '')
        },
        clearChat() {
            this.agent?.clear()
            this.messages = [this.messages[0]]
            this.toolEvents = []
            this.thinkingText = ''
        },
        async switchModel() {
            try {
                this.busy = true
                await this.agent.switchModel(this.selectedModelId)
            } catch (error) {
                this.addAssistantMessage(`I could not load that model: ${error.message || error}`)
            } finally {
                this.busy = false
            }
        },
        stopGeneration() {
            this.agent?.abort()
            this.busy = false
            const current = this.messages[this.messages.length - 1]
            if (current?.streaming) current.streaming = false
        },
        async sendMessage(text = this.draft, context = this.pendingContext) {
            const prompt = String(text || '').trim()
            if (!prompt || this.busy) return

            this.draft = ''
            this.pendingContext = {}
            this.thinkingText = ''
            this.toolEvents = []
            this.messages.push({ id: `${Date.now()}-user`, role: 'user', content: prompt })
            const assistantMessage = {
                id: `${Date.now()}-assistant`,
                role: 'assistant',
                content: '',
                streaming: true,
            }
            this.messages.push(assistantMessage)
            this.busy = true
            this.scrollToBottom()

            try {
                this.agent.updateOptions(this.chatSettings)
                const response = await this.agent.run(prompt, {
                    modelId: this.selectedModelId,
                    context,
                })
                if (!assistantMessage.content.trim()) {
                    assistantMessage.content = response
                }
            } catch (error) {
                assistantMessage.content = `I could not complete that request. ${error.message || error}`
            } finally {
                assistantMessage.streaming = false
                this.busy = false
                this.thinkingText = ''
                this.scrollToBottom()
            }
        },
        addAssistantMessage(content) {
            this.messages.push({
                id: `${Date.now()}-assistant-note`,
                role: 'assistant',
                content,
            })
            this.scrollToBottom()
        },
        describeAction(action) {
            if (action.type === 'configure_training_draft') {
                return `Model ${action.payload?.algoId || 'recommended'} · Target ${action.payload?.target || this.settings.target || 'current'}`
            }
            return action.type
        },
        approveAction(action) {
            this.settings.approveAssistantAction(action.id)
            if (action.type === 'configure_training_draft') {
                this.settings.setActiveTab(2)
                if (action.payload?.target) this.settings.setTarget(action.payload.target)
                if (action.payload?.taskMode) this.settings.setTaskMode(action.payload.taskMode)
                this.addAssistantMessage('Draft approved. I opened Model Training and staged the target/task choice for review.')
            }
        },
        dismissAction(action) {
            this.settings.dismissAssistantAction(action.id)
        },
        scrollToBottom() {
            this.$nextTick(() => {
                if (this.$refs.messagesEl) {
                    this.$refs.messagesEl.scrollTop = this.$refs.messagesEl.scrollHeight
                }
            })
        },
    },
}
</script>

<style scoped>
.gemma-assistant {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 80;
    font-family: Inter, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.gemma-fab {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    border: 0;
    border-radius: 999px;
    padding: 0.8rem 1rem;
    color: #fff;
    background: linear-gradient(135deg, #4f46e5, #06b6d4);
    box-shadow: 0 18px 40px rgba(79, 70, 229, 0.3);
    font-weight: 800;
    cursor: pointer;
}

.gemma-fab__spark {
    display: inline-grid;
    width: 1.8rem;
    height: 1.8rem;
    place-items: center;
    border-radius: 50%;
    color: #4f46e5;
    background: #fff;
}

.gemma-panel {
    width: min(430px, calc(100vw - 32px));
    height: min(680px, calc(100vh - 48px));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.24);
    backdrop-filter: blur(18px);
}

.gemma-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.1rem;
    color: #f8fafc;
    background: linear-gradient(135deg, #312e81, #0891b2);
}

.gemma-panel__eyebrow {
    margin: 0;
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.gemma-panel h3 {
    margin: 0.1rem 0 0;
    color: #fff;
    font-size: 1.15rem;
    font-weight: 900;
}

.gemma-panel__actions {
    display: inline-flex;
    gap: 0.45rem;
}

.gemma-panel__actions button {
    width: 2rem;
    height: 2rem;
    border: 1px solid rgba(255, 255, 255, 0.26);
    border-radius: 999px;
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
    cursor: pointer;
}

.gemma-status,
.gemma-settings {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.55rem 1rem;
    border-bottom: 1px solid rgba(226, 232, 240, 0.9);
    color: #475569;
    background: #f8fafc;
    font-size: 0.78rem;
}

.gemma-status--ready {
    color: #047857;
}

.gemma-status--error {
    color: #b91c1c;
}

.gemma-settings label {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    color: #64748b;
    font-weight: 700;
}

.gemma-settings select {
    max-width: 190px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 0.35rem 0.45rem;
    background: #fff;
    color: #0f172a;
}

.gemma-toggle {
    white-space: nowrap;
}

.gemma-messages {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
    padding: 1rem;
    background:
        radial-gradient(circle at top left, rgba(14, 165, 233, 0.08), transparent 32%),
        #ffffff;
}

.gemma-message {
    max-width: 86%;
    padding: 0.7rem 0.85rem;
    border-radius: 16px;
    color: #1e293b;
    font-size: 0.86rem;
    line-height: 1.45;
}

.gemma-message :deep(p) {
    margin: 0 0 0.5rem;
}

.gemma-message :deep(p:last-child) {
    margin-bottom: 0;
}

.gemma-message :deep(code) {
    padding: 0.08rem 0.28rem;
    border-radius: 5px;
    background: #eef2ff;
}

.gemma-message--assistant {
    align-self: flex-start;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
}

.gemma-message--user {
    align-self: flex-end;
    color: #fff;
    background: linear-gradient(135deg, #4f46e5, #0891b2);
}

.gemma-message--user p {
    margin: 0;
    white-space: pre-wrap;
}

.gemma-message--thinking,
.gemma-tool-log {
    align-self: flex-start;
    max-width: 88%;
    border: 1px dashed #bae6fd;
    background: #f0f9ff;
    color: #0369a1;
    font-size: 0.75rem;
}

.gemma-actions {
    display: grid;
    gap: 0.55rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
}

.gemma-action-card {
    display: grid;
    gap: 0.35rem;
    padding: 0.7rem;
    border: 1px solid #bfdbfe;
    border-radius: 12px;
    background: #eff6ff;
    color: #1e3a8a;
    font-size: 0.8rem;
}

.gemma-action-card__buttons {
    display: flex;
    gap: 0.5rem;
}

.gemma-action-card__buttons button {
    border: 0;
    border-radius: 999px;
    padding: 0.35rem 0.7rem;
    background: #2563eb;
    color: #fff;
    cursor: pointer;
}

.gemma-tool-log {
    padding: 0.55rem 0.75rem;
    border-radius: 14px;
}

.gemma-tool-log p {
    margin: 0.15rem 0;
}

.gemma-suggestions {
    display: grid;
    gap: 0.45rem;
    padding: 0.75rem 1rem 0;
    background: #fff;
}

.gemma-suggestions button {
    border: 1px solid #dbeafe;
    border-radius: 12px;
    padding: 0.55rem 0.7rem;
    color: #1d4ed8;
    background: #eff6ff;
    font-size: 0.78rem;
    text-align: left;
    cursor: pointer;
}

.gemma-input {
    display: flex;
    gap: 0.6rem;
    padding: 0.8rem 1rem 1rem;
    border-top: 1px solid #e2e8f0;
    background: #fff;
}

.gemma-input textarea {
    flex: 1;
    resize: none;
    min-height: 46px;
    border: 1px solid #cbd5e1;
    border-radius: 14px;
    padding: 0.65rem;
    color: #0f172a;
    outline: none;
}

.gemma-input button {
    align-self: stretch;
    min-width: 68px;
    border: 0;
    border-radius: 14px;
    color: #fff;
    background: #2563eb;
    font-weight: 800;
    cursor: pointer;
}

.gemma-input button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.gemma-input .gemma-stop {
    background: #dc2626;
}
</style>
