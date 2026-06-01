let danfoPromise = null;
let plotlyPromise = null;

function resolveDanfoModule(mod) {
    if (mod?.dfd?.DataFrame) return mod.dfd;
    if (mod?.default?.dfd?.DataFrame) return mod.default.dfd;
    if (mod?.default?.DataFrame) return mod.default;
    if (mod?.DataFrame) return mod;
    throw new Error('Danfo.js failed to load (DataFrame export missing)');
}

export const getDanfo = async () => {
    if (!danfoPromise) {
        danfoPromise = import('danfojs/lib/bundle.js').then(resolveDanfoModule);
    }
    return danfoPromise;
};

export const getPlotly = async () => {
    if (!plotlyPromise) {
        plotlyPromise = await import('danfojs/node_modules/plotly.js-dist-min');
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
