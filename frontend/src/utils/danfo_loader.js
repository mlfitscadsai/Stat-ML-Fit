let danfoPromise = null;
let plotlyPromise = null;

async function ensureTensorflowBackends() {
    await import('@tensorflow/tfjs');
    await import('@tensorflow/tfjs-backend-cpu');
    await import('@tensorflow/tfjs-backend-webgl');
}

export const getDanfo = async () => {
    if (!danfoPromise) {
        danfoPromise = (async () => {
            await ensureTensorflowBackends();
            const mod = await import('danfojs/dist/danfojs-browser/src/index');
            return mod.default ?? mod;
        })();
    }
    return danfoPromise;
};

export const getPlotly = async () => {
    if (!plotlyPromise) {
        plotlyPromise = await import('danfojs/node_modules/plotly.js-dist-min');
        // eslint-disable-next-line no-undef
        plotlyPromise.setPlotConfig({
            autosize: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['resetScale2d', 'zoom2d', 'pan', 'select2d', 'resetViews', 'sendDataToCloud', 'hoverCompareCartesian', 'lasso2d', 'drawopenpath '], // Remove certain buttons from the mode bar
        });
        window.Plotly = plotlyPromise;
    }
    return plotlyPromise;
};

let highChartPromise = null;
export const highChartLoader = async () => {
    if (!highChartPromise) {
        highChartPromise = import('highcharts').then((module) => {
            window.Highcharts = module.default;
            return import('highcharts/modules/heatmap');
        }).then(() => window.Highcharts);
    }
    return highChartPromise;
};
