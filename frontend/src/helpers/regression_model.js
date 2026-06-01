
import { ChartController } from '@/helpers/charts';
import { calculateMSE, calculateRSquared, predictions_table_regression } from './utils.js';
import { getDatatable } from '@/utils/datatable_loader.js';
import { getPlotly } from '@/utils/danfo_loader.js';

export class RegressionModel {

    constructor() {
        this.chartController = new ChartController();
        this.task = null;
        this.predictions = [];
        this.id = null;
        this.plots = [];
        this.tables = [];
        this.helpSectionId = 'help';
        this.hasExplaination = true;
        this.seed = 123;

    }
    async train(x, y, x_test, y_test) {
        throw new Error('Not implemented', x, y, x_test, y_test)
    }
    async evaluateModel(y, predictions) {
        const mse = calculateMSE(y, predictions);
        const rsquared = calculateRSquared(y, predictions);
        const rmse = Math.sqrt(mse);
        const n = y.length;
        const mae = y.reduce((acc, val, i) => acc + Math.abs(val - predictions[i]), 0) / n;
        return { mse, rmse, mae, rsquared };
    }
    async visualize(x_test, y_test, _, predictions) {
        let current = this;
        // Ensure both Plotly and DataTables are ready before attempting to render
        await getPlotly();
        await getDatatable();
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    let y = y_test;
                    let residuals = predictions.map((pred, i) => y[i] - pred);
                    current.chartController.yhat_plot(y, predictions, 'regression_y_yhat_' + current.id, 'Predictions vs y');
                    current.chartController.residual_plot(predictions, residuals, 'errors_' + current.id, 'Residuals vs Fitted');
                    this.plots.push('regression_y_yhat_' + current.id);
                    this.plots.push('errors_' + current.id);
                } catch (plotErr) {
                    console.error('Regression chart render error:', plotErr);
                }
                try {
                    predictions_table_regression(x_test, y_test, predictions, this.id);
                    this.tables.push('#predictions_table_' + this.id);
                } catch (tableErr) {
                    console.warn('Predictions table render skipped:', tableErr);
                }
                resolve('resolved');
            }, 500);
        });
    }
}