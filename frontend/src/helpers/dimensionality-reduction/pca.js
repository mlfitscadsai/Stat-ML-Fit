import { asyncRun } from "../py-worker";
export default class PCA {

    async predict(x, n, seed = 42, x_test = [], scaleData = true) {
        this.context = {
            x_train: x,
            x_test: x_test,
            has_test_set: x_test.length > 0,
            n: +n,
            seed: Math.round(Number(seed) || 42),
            scale_data: scaleData !== false,
        };
        const script = `
        import numpy as np
        from sklearn.decomposition import PCA
        from js import x_train,n,x_test,has_test_set,seed,scale_data
        from sklearn.preprocessing import StandardScaler
        x_train = np.array(x_train)
        if scale_data:
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(x_train)
        else:
            X_scaled = x_train
            scaler = None
        n_samples, n_features = X_scaled.shape
        n_components = min(int(n), n_samples, n_features)
        pca_x = PCA(n_components=n_components, random_state=int(seed))
        pca = pca_x.fit_transform(np.array(X_scaled))
        pca_test=[]
        if has_test_set:
            x_test = np.array(x_test)
            if scaler is not None:
                x_test_scaled = scaler.transform(x_test)
            else:
                x_test_scaled = x_test
            pca_test = pca_x.transform(np.array(x_test_scaled))
        ccircle = []
        eucl_dist = []
        if pca.shape[1] >= 2:
            for i,j in enumerate(X_scaled.T):
                if np.std(j) == 0 or np.std(pca[:,0]) == 0 or np.std(pca[:,1]) == 0:
                    corr1, corr2 = 0.0, 0.0
                else:
                    c1 = np.corrcoef(j,pca[:,0])[0,1]
                    c2 = np.corrcoef(j,pca[:,1])[0,1]
                    corr1 = float(c1) if not np.isnan(c1) else 0.0
                    corr2 = float(c2) if not np.isnan(c2) else 0.0
                ccircle.append((corr1, corr2))
                eucl_dist.append(np.sqrt(corr1**2 + corr2**2))
        else:
            for i in range(X_scaled.shape[1]):
                ccircle.append((0.0, 0.0))
                eucl_dist.append(0.0)
        (pca,np.arange(1, len(pca_x.explained_variance_ratio_) + 1), pca_x.explained_variance_ratio_,ccircle,eucl_dist,pca_test)
    `;
        const { results, error } = await asyncRun(script, this.context);
        if (error) {
            throw new Error(`PCA Python error: ${error}`);
        }
        if (!results) {
            throw new Error('PCA returned no results');
        }
        return results;
    }

}
