let danfoPromise = null;
let plotlyPromise = null;

/** Official browser build — lib/bundle.js is a webpack IIFE without ESM exports. */
const DANFO_ENTRY = 'danfojs/dist/danfojs-browser/src/index.js';

function pickDanfoNamespace(mod) {
    if (!mod) return null;
    if (typeof mod.DataFrame === 'function') return mod;
    if (typeof mod.default?.DataFrame === 'function') return mod.default;
    if (typeof mod.dfd?.DataFrame === 'function') return mod.dfd;
    if (typeof mod.default?.dfd?.DataFrame === 'function') return mod.default.dfd;
    const globalDfd = typeof globalThis !== 'undefined' ? globalThis.dfd : null;
    if (typeof globalDfd?.DataFrame === 'function') return globalDfd;
    return null;
}

function resolveDanfoModule(mod) {
    const namespace = pickDanfoNamespace(mod);
    if (namespace) return namespace;
    throw new Error('Danfo.js failed to load (DataFrame export missing)');
}

export const getDanfo = async () => {
    if (!danfoPromise) {
        danfoPromise = import(/* @vite-ignore */ DANFO_ENTRY)
            .then(resolveDanfoModule)
            .catch((err) => {
                danfoPromise = null;
                throw err;
            });
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
