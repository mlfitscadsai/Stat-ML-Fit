
import { ClassificationModel } from '../model';
import { asyncRun } from "@/helpers/py-worker";

export default class KNNModel extends ClassificationModel {
    constructor(options) {
        super();
        this.options = options
        this.model = null;
        this.hasProbability = true;
        this.helpSectionId = 'knn_help';


    }
    // eslint-disable-next-line no-unused-vars
    async train(x, y, x_test, y_test, columns, __, pdpIndex) {
        this.context = {
            X_train: x,
            y_train: y,
            X_test: x_test,
            y_test: y_test,
            min: +this.options.min.value,
            max: +this.options.max.value,
            explain: this.hasExplaination,
            features: [...Array(columns.length).keys()]
        };
        const script = `
        import matplotlib
        matplotlib.use("AGG")
        from js import X_train,y_train,X_test,y_test,features,min,max,explain
        from sklearn.inspection import PartialDependenceDisplay
        from sklearn.inspection import permutation_importance
        from sklearn.neighbors import KNeighborsClassifier
        from sklearn.metrics import accuracy_score, roc_curve, roc_auc_score
        from sklearn.preprocessing import label_binarize
        import numpy as np

        features_importance = []
        partial_dependence_plot_grids = []
        partial_dependence_plot_avgs = []
        fprs = []
        tprs = []
        aucs = []
        probas = []

        k_neighbor_results=[]
        best_model = None
        best_accuracy = 0
        best_preds = []
        for i,metric in enumerate(['manhattan','euclidean']):
            for n in range(min,max+1):
                model = KNeighborsClassifier(n_neighbors=n,metric=metric)
                model.fit(X_train, y_train)
                preds = model.predict(X_test)
                accuracy = accuracy_score(y_test,preds)
                k_neighbor_results.append([metric,n,accuracy])
                if accuracy > best_accuracy:
                    best_accuracy = accuracy
                    best_model = model
                    best_n = n
                    best_preds = preds
        if best_model is not None:
            probas = best_model.predict_proba(X_test)
            classes = best_model.classes_
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
            pdp = PartialDependenceDisplay.from_estimator(best_model, X_train, features,target=0,method ='brute')
            fi = permutation_importance(best_model,X_test,y_test,n_repeats=10)
            partial_dependence_plot_avgs = list(map(lambda item:item['average'].tolist(),pdp.pd_results))
            grids = list(map(lambda item:item['grid_values'],pdp.pd_results))
            features_importance = list(fi.importances)
            partial_dependence_plot_grids = [item[0].tolist() for item in grids ]
        best_preds,partial_dependence_plot_avgs,partial_dependence_plot_grids, features_importance,k_neighbor_results,best_n,fprs,tprs,aucs,probas
    `;
        try {
            const { results, error } = await asyncRun(script, this.context);
            if (results) {
                this.predictions = Array.from(results[0]);
                this.pdp_averages = Array.from(results[1]);
                this.pdp_grid = Array.from(results[2]);
                this.importances = Array.from(results[3]);
                this.k_neighbor_results = Array.from(results[4]);
                this.best_n = results[5];
                this.fpr = Array.from(results[6]);
                this.tpr = Array.from(results[7]);
                this.auc = Array.from(results[8]);
                this.probas = Array.from(results[9]);
                return Array.from(results[0]);
            } else if (error) {
                console.log("pyodideWorker error: ", error);
            }
        } catch (e) {
            throw Error(`Error in pyodideWorker at ${e.filename}, Line: ${e.lineno}, ${e.message}`,)

        }
    }
    generatePythonCode() {
        let model_import = `
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score`.trim();
        let model_fit = `
best_model = None
best_accuracy = 0
best_preds = []
for i,metric in enumerate(['manhattan','euclidean']):
    for n in range(${+this.options.min.value},${+this.options.max.value + 1}):
        model = KNeighborsClassifier(n_neighbors=n,metric=metric)
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        accuracy = accuracy_score(y_test,preds)
        if accuracy > best_accuracy:
            best_accuracy = accuracy
            best_model = model
            best_n = n
            best_preds = preds
model = best_model
`.trim();
        return super.generatePythonCode(model_import, model_fit)
    }
    async visualize(x_test, y_test, uniqueLabels, predictions, encoder, columns, categorical_columns) {
        await super.visualize(x_test, y_test, uniqueLabels, predictions, encoder)
        this.chartController.KNNPerformancePlot(this.k_neighbor_results, this.best_n, this.id);
        this.plots.push('knn_table_' + this.id);
        if (this.hasExplaination) {
            this.chartController.PFIBoxplot(this.id, this.importances, columns);
            this.chartController.plotPDP(this.id, this.pdp_averages, this.pdp_grid, uniqueLabels, columns, categorical_columns);
        }
        this.chartController.plotROC(this.id, this.fpr, this.tpr, uniqueLabels, this.auc);
        this.chartController.probabilities_boxplot(this.probas, encoder.inverseTransform(predictions), uniqueLabels, this.id);

    }

}
