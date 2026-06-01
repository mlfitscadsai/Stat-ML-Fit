import { UMAP } from 'umap-js';

export default class UMAPReducer {
    /**
     * Fit and transform data with UMAP.
     *
     * @param {number[][]} x               - 2-D feature matrix (rows = samples)
     * @param {number}     nComponents     - output dimensions (2 or 3)
     * @param {number}     nNeighbors      - controls local vs global structure (default 15)
     * @param {number}     minDist         - minimum distance in embedded space (default 0.1)
     * @param {number}     spread          - scale of embedded points (default 1.0)
     * @param {number}     seed            - random seed (default 42)
     * @param {number}     nEpochs         - optimisation epochs (0 = auto)
     * @param {function}   [onEpoch]       - optional callback(epoch, totalEpochs)
     * @returns {Promise<number[][]>}       - embedded coordinates
     */
    async predict(
        x,
        nComponents = 2,
        nNeighbors = 15,
        minDist = 0.1,
        spread = 1.0,
        seed = 42,
        nEpochs = 0,
        onEpoch = null
    ) {
        // Sanitise input
        const data = Array.isArray(x)
            ? x.map(row => (Array.isArray(row) ? row : [row]).map(v => Number(v)))
               .filter(row => row.every(Number.isFinite))
            : [];

        if (data.length < 4) {
            throw new Error('UMAP requires at least 4 samples.');
        }
        const dim = data[0].length;
        if (dim < 1) throw new Error('UMAP: input has no features.');

        const safeNeighbors = Math.min(Math.max(2, Math.round(nNeighbors)), data.length - 1);
        const safeDim = [2, 3].includes(Number(nComponents)) ? Number(nComponents) : 2;
        const safeEpochs = nEpochs > 0 ? Math.round(nEpochs) : undefined;
        const safeSpread = Math.max(0.1, Number(spread) || 1.0);
        const safeMinDist = Math.min(safeSpread, Math.max(0.001, Number(minDist) || 0.1));

        const standardizedData = this._standardize(data);

        const umap = new UMAP({
            nComponents: safeDim,
            nNeighbors: safeNeighbors,
            minDist: safeMinDist,
            spread: safeSpread,
            random: this._seededRandom(seed),
            nEpochs: safeEpochs,
        });

        // Step-by-step with async breaks to keep the UI responsive
        if (typeof onEpoch === 'function') {
            umap.initializeFit(standardizedData);
            const totalSteps = umap.getNEpochs();
            // Process in chunks of ~10 epochs to avoid blocking the event loop
            const chunkSize = 10;
            for (let i = 0; i < totalSteps; i += chunkSize) {
                const end = Math.min(i + chunkSize, totalSteps);
                for (let j = i; j < end; j++) umap.step();
                onEpoch(end, totalSteps);
                // Yield to the event loop between chunks
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            return umap.getEmbedding();
        }

        return umap.fit(standardizedData);
    }

    _standardize(data) {
        if (data.length === 0) return data;
        const nSamples = data.length;
        const nFeatures = data[0].length;

        // Calculate means
        const means = new Array(nFeatures).fill(0);
        for (let i = 0; i < nSamples; i++) {
            for (let j = 0; j < nFeatures; j++) {
                means[j] += data[i][j];
            }
        }
        for (let j = 0; j < nFeatures; j++) {
            means[j] /= nSamples;
        }

        // Calculate standard deviations
        const stds = new Array(nFeatures).fill(0);
        for (let i = 0; i < nSamples; i++) {
            for (let j = 0; j < nFeatures; j++) {
                const diff = data[i][j] - means[j];
                stds[j] += diff * diff;
            }
        }
        for (let j = 0; j < nFeatures; j++) {
            stds[j] = Math.sqrt(stds[j] / nSamples) + 1e-7;
        }

        // Standardize
        return data.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
    }

    /** Simple LCG seeded random in [0, 1) for reproducibility */
    _seededRandom(seed) {
        let s = (seed || 42) >>> 0;
        return () => {
            s = (Math.imul(1664525, s) + 1013904223) >>> 0;
            return s / 0x100000000;
        };
    }
}
