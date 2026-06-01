<template>
    <section class="job-center">
        <header class="job-center__head">
            <div>
                <p class="job-center__eyebrow">HPC Job Center</p>
                <h3>Remote run timeline</h3>
            </div>
            <span>{{ jobs.length }} job(s)</span>
        </header>
        <div v-if="jobs.length" class="job-center__list">
            <article v-for="job in jobs" :key="job.id" class="job-center__item">
                <strong>{{ job.methodName || job.id }}</strong>
                <span>{{ job.status }}</span>
                <small v-if="job.target">Target: {{ job.target }}</small>
            </article>
        </div>
        <p v-else class="job-center__empty">HPC jobs will appear here when remote training starts.</p>
    </section>
</template>

<script>
import { settingStore } from '@/stores/settings'

export default {
    name: 'HpcJobCenterComponent',
    setup() {
        return { settings: settingStore() }
    },
    computed: {
        jobs() {
            return this.settings.hpcJobs || []
        },
    },
}
</script>

<style scoped>
.job-center {
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    background: #f8fafc;
}
.job-center__head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.8rem;
}
.job-center__eyebrow {
    margin: 0;
    color: #0f766e;
    font-size: 0.7rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}
.job-center h3 {
    margin: 0.1rem 0 0;
}
.job-center__list {
    display: grid;
    gap: 0.55rem;
}
.job-center__item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.2rem 0.7rem;
    padding: 0.7rem;
    border: 1px solid #ccfbf1;
    border-radius: 12px;
    background: #fff;
}
.job-center__item small {
    grid-column: 1 / -1;
    color: #64748b;
}
.job-center__empty {
    margin: 0;
    color: #64748b;
    font-size: 0.85rem;
}
</style>
