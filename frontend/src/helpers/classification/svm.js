import { ClassificationModel } from "../model";
import { asyncRun } from "@/helpers/py-worker";

export default class SupportVectorMachine extends ClassificationModel {
    constructor(opt) {
        super();
        // eslint-disable-next-line no-unused-vars
        this.options = {
            kernel: opt.kernel.value.toLowerCase(),
            coef: opt.bias.value,
            degree: opt.degree.value,
            c: opt.c.value,
            quiet: true
        };
        this.hasProbability = true;
        this.helpSectionId = 'svm_help';
    }
    // eslint-disable-next-line no-unused-vars
    async train(x_train, y_train, x_test, y_test, columns, __, pdpIndex) {

        this.context = {
            X_train: x_train,
            y_train: y_train,
            X_test: x_test,
            y_test: y_test,
            pdpIndex: pdpIndex,
            explain: this.hasExplaination,
            kernel: this.options.kernel,
            coef: this.options.coef,
            c: +this.options.c,
            degree: this.options.degree,
            seed: this.seed,
            features: [...Array(columns.length).keys()]

        };
        const script = `
        from sklearn import svm
        from js import X_train,y_train,X_test,y_test,kernel,coef,degree,features,seed,c,explain
        import numpy as np
        import matplotlib
        matplotlib.use("AGG")
        from sklearn.inspection import partial_dependence
        from sklearn.inspection import permutation_importance
        from sklearn.metrics import roc_curve, roc_auc_score
        from sklearn.preprocessing import label_binarize
        import numpy as np
        features_importance = []
        partial_dependence_plot_grids = []
        partial_dependence_plot_avgs = []
        fprs=[]
        tprs=[]
        aucs=[]
        probas=[]

        model = svm.SVC(kernel=kernel,random_state = seed,C=c,degree=degree,probability=True)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        probas = model.predict_proba(X_test)
        classes = model.classes_
        if len(classes) == 2:
            fpr,tpr,_ = roc_curve(y_test, probas[:, 1])
            auc = roc_auc_score(y_test, probas[:, 1])
            fprs.append(fpr)
            tprs.append(tpr)
            aucs.append(auc)
        else:
            y_test_one_hot = label_binarize(y_test, classes=classes)
            auc = roc_auc_score(y_test_one_hot, probas, multi_class='ovr')
            aucs.append(auc)
            for i in range(len(classes)):
                fpr,tpr,_ = roc_curve(y_test_one_hot[:, i], probas[:, i])
                fprs.append(fpr)
                tprs.append(tpr)

        if explain:
            # Compute permutation feature importance independently so it can still
            # be shown even if PDP fails.
            try:
                fi = permutation_importance(model,X_test,y_test,n_repeats=10)
                features_importance = list(fi.importances)
            except Exception:
                features_importance = []

            try:
                for feature in features:
                    pdp_result = partial_dependence(model, X_train, [feature], kind='average')
                    average = pdp_result['average']
                    grid_values = pdp_result['grid_values'] if 'grid_values' in pdp_result else pdp_result['values']

                    # average shape can be (n_targets, n_grid_points) or (n_grid_points,)
                    if hasattr(average, 'ndim') and average.ndim > 1:
                        partial_dependence_plot_avgs.append(average[0].tolist())
                    else:
                        partial_dependence_plot_avgs.append(average.tolist())

                    partial_dependence_plot_grids.append(grid_values[0].tolist())
            except Exception:
                # Fallback: compute PDP manually so users still get explainability.
                try:
                    X_ref = np.array(X_train, dtype=np.float64)
                    for feature in features:
                        feature_values = X_ref[:, feature]
                        unique_values = np.unique(feature_values)
                        if unique_values.size <= 8:
                            grid = np.sort(unique_values)
                        else:
                            quantiles = np.linspace(0.05, 0.95, 8)
                            grid = np.quantile(feature_values, quantiles)
                            grid = np.unique(grid)

                        avg_curve = []
                        for grid_value in grid:
                            X_tmp = X_ref.copy()
                            X_tmp[:, feature] = grid_value
                            if hasattr(model, "predict_proba"):
                                model_output = model.predict_proba(X_tmp)
                                y_hat = model_output[:, 1] if model_output.ndim > 1 and model_output.shape[1] > 1 else model_output.ravel()
                            elif hasattr(model, "decision_function"):
                                model_output = model.decision_function(X_tmp)
                                y_hat = model_output[:, 0] if hasattr(model_output, "ndim") and model_output.ndim > 1 else model_output
                            else:
                                y_hat = model.predict(X_tmp)
                            avg_curve.append(float(np.mean(y_hat)))

                        partial_dependence_plot_grids.append(grid.tolist())
                        partial_dependence_plot_avgs.append(avg_curve)
                except Exception:
                    partial_dependence_plot_grids = []
                    partial_dependence_plot_avgs = []
        y_pred,partial_dependence_plot_avgs,partial_dependence_plot_grids,features_importance,fprs,tprs,aucs,probas
    `;
        try {
            const { results, error } = await asyncRun(script, this.context);
            if (results) {
                this.predictions = Array.from(results[0]);
                this.pdp_averages = Array.from(results[1]);
                this.pdp_grid = Array.from(results[2]);
                this.importances = Array.from(results[3]);
                this.fpr = Array.from(results[4]);
                this.tpr = Array.from(results[5]);
                this.auc = Array.from(results[6]);
                this.probas = Array.from(results[7]);
                return Array.from(results[0]);
            } else if (error) {
                console.log("pyodideWorker error: ", error);
                throw Error(`SVM training failed: ${error}`)
            }
        } catch (e) {
            throw Error(`Error in pyodideWorker at ${e.filename}, Line: ${e.lineno}, ${e.message}`,)

        }
    }
    generatePythonCode() {
        let model_import = "from sklearn import svm"
        let model_fit = `
model = model = svm.SVC(kernel="${this.options.kernel}",random_state = ${this.seed})`
        return super.generatePythonCode(model_import, model_fit)
    }
    async visualize(x_test, y_test, uniqueLabels, predictions, encoder, columns, categorical_columns) {
        await super.visualize(x_test, y_test, uniqueLabels, predictions, encoder)
        if (this.hasExplaination && this.importances?.length > 0) {
            this.chartController.PFIBoxplot(this.id, this.importances, columns);
        }
        if (this.hasExplaination && this.pdp_averages?.length > 0) {
            this.chartController.plotPDP(this.id, this.pdp_averages, this.pdp_grid, uniqueLabels, columns, categorical_columns);
        }
        this.chartController.plotROC(this.id, this.fpr, this.tpr, uniqueLabels, this.auc);
        this.chartController.probabilities_boxplot(this.probas, encoder.inverseTransform(predictions), uniqueLabels, this.id);
    }
}
