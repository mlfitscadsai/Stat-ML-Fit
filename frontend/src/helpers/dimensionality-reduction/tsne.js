import { asyncRun } from "../py-worker";
export default class TSNE {
    constructor() {
    }
    async predict(x, n, seed = 123, perplexity = 30) {
        const n_samples = x.length;
        const maxPerplexity = Math.max(1, n_samples - 1);
        const safePerplexity = Math.min(Math.max(1, Math.round(perplexity) || 30), maxPerplexity);

        this.context = {
            x_train: x,
            n: +n,
            seed: seed,
            perplexity: safePerplexity,
        };
        const script = `
        from sklearn.manifold import TSNE
        import numpy as np
        from js import x_train, n, seed, perplexity
        from sklearn.preprocessing import StandardScaler
        X = np.array(x_train)
        X_scaled = StandardScaler().fit_transform(X)
        embedded = TSNE(n_components=n, learning_rate='auto', perplexity=float(perplexity), random_state=seed).fit_transform(X_scaled)
        embedded
    `;
        try {
            const { results, error } = await asyncRun(script, this.context);
            if (results) {
                return results;
            } else if (error) {
                throw new Error("Faced error fitting t-SNE: " + error);
            }
        } catch (e) {
            throw new Error("Failed to fit t-SNE: " + e.message);
        }
    }

}
