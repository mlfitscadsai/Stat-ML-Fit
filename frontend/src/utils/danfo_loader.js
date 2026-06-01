let danfoPromise = null;
let plotlyPromise = null;

export const getDanfo = async () => {
    if (!danfoPromise) {
        danfoPromise = import('danfojs/dist/danfojs-browser/src/index').then((mod) => mod.default ?? mod);
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
            modeBarButtonsToRemove: ['resetScale2d', 'zoom2d', 'pan', 'select2d', 'resetViews', 'sendDataToCloud', 'hoverCompareCartesian', 'lasso2d', 'drawopenpath '],
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
