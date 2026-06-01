import { asyncRun } from "@/helpers/py-worker";
import { ClassificationModel } from '../model';
export default class Boosting extends ClassificationModel {
    constructor(opt, chartControler) {
        super(chartControler);
        let options = {
            booster: opt.booster.value ?? "gbtree",
            objective: "multi:softmax",
            max_depth: +opt.depth.value,
            eta: +opt.eta.value,
            estimators: opt.estimators.value ?? 200
        }
        this.options = options;
        this.hasProbability = true;
        this.helpSectionId = 'cart_help';

    }
    // eslint-disable-next-line no-unused-vars
    async train(x, y, x_test, y_test, columns, __, pdpIndex) {
        this.context = {
            X_train: x,
            y_train: y,
            X_test: x_test,
            y_test: y_test,
            objective: this.options.objective,
            max_depth: this.options.max_depth,
            eta: this.options.eta,
            estimators: this.options.estimators,
            seed: this.seed,
            pdpIndex: pdpIndex,
            features: [...Array(columns.length).keys()],
            explain: this.hasExplaination
        };
        const script = `
        import matplotlib
        matplotlib.use("AGG")
        from js import X_train,y_train,X_test,y_test,objective,max_depth,eta,estimators,seed,features,explain
        from sklearn.inspection import PartialDependenceDisplay
        from sklearn.inspection import permutation_importance
        from sklearn.ensemble import GradientBoostingClassifier
        from sklearn.metrics import roc_curve, roc_auc_score
        from sklearn.preprocessing import label_binarize
        import numpy as np

        features_importance = []
        partial_dependence_plot_grids = []
        partial_dependence_plot_avgs = []
        fprs = []
        tprs = []
        aucs = []
        probas = []

        model = GradientBoostingClassifier(learning_rate = eta,n_estimators = estimators,max_depth =max_depth,random_state = seed )
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        probas = model.predict_proba(X_test)
        classes = model.classes_
        if len(classes) == 2:
            fpr, tpr, _ = roc_curve(y_test, probas[:, 1])
            auc = roc_auc_score(y_test, probas[:, 1])
            fprs.append(fpr)
            tprs.append(tpr)
            aucs.append(auc)
        else:
            y_test_one_hot = label_binarize(y_test, classes=classes)
            auc = roc_auc_score(y_test_one_hot, probas, multi_class='ovr')
            aucs.append(auc)
            for i in range(len(classes)):
                fpr, tpr, _ = roc_curve(y_test_one_hot[:, i], probas[:, i])
                fprs.append(fpr)
                tprs.append(tpr)
        if explain:
            pdp = PartialDependenceDisplay.from_estimator(model, X_train, features,target=0,method ='brute')
            fi = permutation_importance(model,X_test,y_test,n_repeats=10)
            partial_dependence_plot_avgs = list(map(lambda item:item['average'].tolist(),pdp.pd_results))
            grids = list(map(lambda item:item['grid_values'],pdp.pd_results))
            features_importance = list(fi.importances)
            partial_dependence_plot_grids = [item[0].tolist() for item in grids ]
        y_pred,partial_dependence_plot_avgs,partial_dependence_plot_grids, features_importance,fprs,tprs,aucs,probas
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
            }
        } catch (e) {
            throw Error(`Error in pyodideWorker at ${e.filename}, Line: ${e.lineno}, ${e.message}`,)

        }
    }
    generatePythonCode() {
        let model_import = "from sklearn.ensemble import GradientBoostingClassifier"
        let model_fit =
            `model = GradientBoostingClassifier(learning_rate = ${this.options.eta} ,n_estimators = ${this.options.estimators} ,max_depth =${this.options.max_depth} ,random_state = ${this.seed} )`;
        return super.generatePythonCode(model_import, model_fit)
    }
    async visualize(x_test, y_test, uniqueLabels, predictions, encoder, columns, categorical_columns) {
        await super.visualize(x_test, y_test, uniqueLabels, predictions, encoder)
        if (this.hasExplaination) {
            this.chartController.PFIBoxplot(this.id, this.importances, columns);
            this.chartController.plotPDP(this.id, this.pdp_averages, this.pdp_grid, uniqueLabels, columns, categorical_columns);
        }
        this.chartController.plotROC(this.id, this.fpr, this.tpr, uniqueLabels, this.auc);
        this.chartController.probabilities_boxplot(this.probas, encoder.inverseTransform(predictions), uniqueLabels, this.id);
    }
}
