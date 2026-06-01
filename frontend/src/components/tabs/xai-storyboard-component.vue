<template>
    <section class="xai-storyboard">
        <header class="xai-storyboard__head">
            <div>
                <p class="xai-storyboard__eyebrow">Explainability Storyboard</p>
                <h3>{{ storyboard.modelName }} narrative</h3>
            </div>
            <span class="xai-storyboard__badge">{{ storyboard.task }}</span>
        </header>

        <div class="xai-storyboard__grid">
            <article v-for="insight in storyboard.insights" :key="`${insight.type}-${insight.title}`" class="xai-storyboard__card">
                <span>{{ insight.title }}</span>
                <strong v-if="insight.feature">{{ insight.feature }}</strong>
                <p>{{ insight.text }}</p>
            </article>
        </div>

        <div class="xai-storyboard__next">
            <strong>Recommended next experiment</strong>
            <p>{{ storyboard.nextExperiment }}</p>
        </div>
    </section>
</template>

<script>
import { buildStoryboard } from '@/services/explainability/xai-normalizer'

export default {
    name: 'XaiStoryboardComponent',
    props: {
        result: {
            type: Object,
            required: true,
        },
    },
    computed: {
        storyboard() {
            return buildStoryboard(this.result)
        },
    },
}
</script>

<style scoped>
.xai-storyboard {
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid #dbeafe;
    border-radius: 18px;
    background: linear-gradient(135deg, #eff6ff, #f8fafc);
}
.xai-storyboard__head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
}
.xai-storyboard__eyebrow {
    margin: 0;
    color: #2563eb;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}
.xai-storyboard h3 {
    margin: 0.15rem 0 0;
    color: #0f172a;
}
.xai-storyboard__badge {
    height: fit-content;
    border-radius: 999px;
    padding: 0.3rem 0.65rem;
    background: #dbeafe;
    color: #1e40af;
    font-size: 0.72rem;
    font-weight: 800;
}
.xai-storyboard__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
}
.xai-storyboard__card {
    padding: 0.8rem;
    border: 1px solid #e0e7ff;
    border-radius: 14px;
    background: #fff;
}
.xai-storyboard__card span {
    color: #64748b;
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
}
.xai-storyboard__card strong {
    display: block;
    margin-top: 0.25rem;
    color: #0f172a;
}
.xai-storyboard__card p,
.xai-storyboard__next p {
    margin: 0.35rem 0 0;
    color: #475569;
    font-size: 0.84rem;
    line-height: 1.45;
}
.xai-storyboard__next {
    margin-top: 0.9rem;
    padding: 0.8rem;
    border-radius: 14px;
    background: #ecfdf5;
    color: #14532d;
}
</style>
