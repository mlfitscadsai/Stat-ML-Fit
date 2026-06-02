let danfoPromise = null;
let plotlyPromise = null;

const DANFO_SCRIPT_URL = '/vendor/danfo.bundle.js';

function readGlobalDanfo() {
    const dfd = typeof globalThis !== 'undefined' ? globalThis.dfd : null;
    if (dfd?.DataFrame) return dfd;
    if (typeof window !== 'undefined' && window.dfd?.DataFrame) return window.dfd;
    return null;
}

function loadDanfoScript() {
    const existing = readGlobalDanfo();
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
        const prior = document.querySelector(`script[data-danfo-bundle="1"]`);
        if (prior) {
            prior.addEventListener('load', () => {
                const dfd = readGlobalDanfo();
                if (dfd) resolve(dfd);
                else reject(new Error('Danfo.js script loaded but DataFrame is missing'));
            });
            prior.addEventListener('error', () => reject(new Error('Danfo.js script failed to load')));
            return;
        }

        const script = document.createElement('script');
        script.src = DANFO_SCRIPT_URL;
        script.async = true;
        script.dataset.danfoBundle = '1';
        script.onload = () => {
            const dfd = readGlobalDanfo();
            if (dfd) resolve(dfd);
            else reject(new Error('Danfo.js failed to load (DataFrame export missing)'));
        };
        script.onerror = () => reject(new Error(`Failed to load ${DANFO_SCRIPT_URL}`));
        document.head.appendChild(script);
    });
}

export const getDanfo = async () => {
    if (!danfoPromise) {
        danfoPromise = loadDanfoScript().catch((err) => {
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
