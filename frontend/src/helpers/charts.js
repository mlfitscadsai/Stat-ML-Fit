/* eslint-disable no-undef */

import PCA from './dimensionality-reduction/pca';
import { equalIntervalBreaks, kernelDensityEstimation, standardDeviation, interquartileRange } from "simple-statistics"
import { schemeTableau10, interpolateRainbow } from 'd3-scale-chromatic';
import { FeatureCategories } from "./settings";
import { metrics as ClassificationMetric, encode_name, scale_data, confusionMatrix } from './utils.js';
import { getDanfo, getPlotly, highChartLoader } from '@/utils/danfo_loader';
import { dfColumn } from '@/utils/danfo_frame';
import { buildScatterplotMatrixTracesAndLayout } from '@/helpers/scatterplot_matrix_impl';
import { labelKey } from '@/helpers/splom_data';
import { getGraphPalette, getParcoordsFonts, getPlotlyAxisDefaults, mergePlotlyLayout } from '@/helpers/chart-theme';
import { getThemeTokens } from '@/services/theme/theme-service';
import TSNE from './dimensionality-reduction/tsne';

function isDarkMode() {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}
const plotlyImageExportConfig = {
    toImageButtonOptions: {
        format: 'png', // one of png, svg, jpeg, webp
        height: null,
        width: null,
        scale: 2
    }
};
export class ChartController {
    constructor() {
        this.color_scheme = schemeTableau10;
        this.color_scheme_sequential = interpolateRainbow;

    }

    // eslint-disable-next-line no-unused-vars
    async classification_target_chart(values, labels, container, title = "") {
        await highChartLoader()
        let uniqueLabels = [...new Set(labels)];
        let colorIndices = labels.map(label => this.indexToColor(uniqueLabels.indexOf(label)));
        let data = [];
        data.push({
            name: "Count",
            data: values.map((item, i) => ({ y: item, color: colorIndices[i] }))
        })

        Highcharts.chart(container, {
            credits: {
                enabled: false
            },
            title: {
                text: ""
            },
            chart: {
                type: 'column'
            },
            xAxis: {
                categories: uniqueLabels,
            },
            yAxis: {
                min: 0,
            },
            plotOptions: {
                column: {
                    pointPadding: 0.1,
                    borderWidth: 0
                }
            },
            colors: colorIndices,
            series: data
        });
    }
    regression_target_chart(items, container, name) {
        let kde_data = [];
        let ys = [];
        let items_range = items
        var breaks = equalIntervalBreaks(items_range, 100);
        let kde = kernelDensityEstimation(items, 'gaussian', 'nrd');
        breaks.forEach((item) => {
            ys.push(kde(item, 'nrd'));
            kde_data.push([item, ys[ys.length - 1]]);
        });


        Highcharts.chart(container, {
            credits: {
                enabled: false
            },
            legend: {
                enabled: false,
                verticalAlign: 'top',
            },
            chart: {
                height: '300',
                type: "spline",
                animation: true,
            },
            title: {
                text: name // Assuming `column` is defined elsewhere
            },
            yAxis: {
                title: { text: null }
            },
            tooltip: {
                valueDecimals: 3
            },
            plotOptions: {
                series: {
                    marker: {
                        enabled: false
                    },
                    dashStyle: "shortdot",
                    area: true
                }
            },
            series: [{
                type: 'area',
                dashStyle: "solid",
                lineWidth: 2,
                data: kde_data
            }]
        });
    }
    draw_categorical_barplot(column_values, title) {
        const key = title + "- barplot";
        $("#categories_barplots").append(`<div class="column is-4" style="height:40vh;" id="${key}"></div>`)
        const countOccurrences = column_values.reduce((acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});
        const countArray = Object.entries(countOccurrences).map(([value, count]) => ({ value: value, count }));
        countArray.sort((a, b) => b.count - a.count);
        const top5 = countArray.slice(0, 5);
        new Highcharts.Chart({
            chart: {
                renderTo: key,
                type: 'column'
            },
            xAxis: {
                categories: top5.map(m => m.value),
            },
            title: {
                text: title
            },
            yAxis: {
                min: 0,
                labels: {
                    overflow: 'justify'
                }
            },
            credits: {
                enabled: false
            },
            plotOptions: {
                bar: {
                    dataLabels: {
                        enabled: true
                    }
                }
            },
            series: [{
                showInLegend: false,
                name: title,
                data: top5.map(m => m.count)
            }]
        });

    }
    roc_chart(container, true_positive_rates, false_positive_rates) {
        var trace = {
            x: false_positive_rates,
            y: true_positive_rates,
            type: 'scatter',
            mode: 'lines',
            name: 'ROC Curve',
        };
        var trace2 = {
            x: [0, 1],
            y: [0, 1],
            type: 'scatter',
            name: 'diagonal',
        };
        var layout = {
            showlegend: false,
            title: 'ROC Curve',
            xaxis: { title: 'False Positive Rate' },
            yaxis: { title: 'True Positive Rate' },
        };

        var data = [trace, trace2];

        window.Plotly.newPlot(container, data, layout);
    }

    indexToColor(index, max) {
        return this.color_scheme_sequential((index + 1) / max);
    }
    indexToColorSequential(value, min, max) {
        let normalizer_value = (value - min) / (max - min)
        return this.color_scheme_sequential(normalizer_value);
    }
    reshape(array, shape) {
        if (shape.length === 0) return array[0];

        const [size, ...restShape] = shape;
        const result = [];
        const restSize = restShape.reduce((a, b) => a * b, 1);
        console.log(restSize);

        for (let i = 0; i < size; i++) {
            result.push(this.reshape(array.slice(i * restSize, (i + 1) * restSize), restShape));
        }

        return result;
    }
    async plot_tsne(data, is_classification, labels, seed, n, perplexity = 30) {
        const Plotly = await getPlotly();
        labels = labels.flat();
        const tsne = new TSNE();
        let Y = await tsne.predict(data, n, seed, perplexity);
        const tsneComponents = Y[0].length;

        let uniqueLabels = [];
        let colors = [];
        if (is_classification) {
            uniqueLabels = [...new Set(labels)];
            colors = labels.map(l =>
                this.indexToColor(uniqueLabels.indexOf(l), uniqueLabels.length)
            );
        } else {
            const nums = labels.map(Number);
            const mn = Math.min(...nums);
            const mx = Math.max(...nums);
            colors = nums.map(v => this.indexToColorSequential(v, mn, mx));
        }

        const legendItems = is_classification
            ? uniqueLabels.map((lab, k) => ({
                  label: String(lab),
                  color: this.indexToColor(k, uniqueLabels.length),
              }))
            : [];
        const tokens = getThemeTokens(isDarkMode());
        const embeddedLegend = {
            x: 0.985,
            y: 0.86,
            xanchor: 'right',
            yanchor: 'top',
            bgcolor: isDarkMode() ? 'rgba(37,37,53,0.92)' : 'rgba(255,255,255,0.88)',
            bordercolor: tokens.border,
            borderwidth: 1,
            font: { size: 10, color: tokens.textMuted },
            itemclick: 'toggle',
            itemdoubleclick: 'toggleothers',
        };

        const markerSize = data.length > 800 ? 4 : 6;

        if (tsneComponents === 2) {
            /* ── Single large scatter (2D) ─────────────────────────────── */
            const traces = is_classification
                ? uniqueLabels.map((lab, k) => {
                      const mask = labels.map((l, r) => (l === lab ? r : -1)).filter(r => r >= 0);
                      return {
                          type: 'scatter',
                          mode: 'markers',
                          name: String(lab),
                          x: mask.map(r => Y[r][0]),
                          y: mask.map(r => Y[r][1]),
                          marker: {
                              color: this.indexToColor(k, uniqueLabels.length),
                              size: markerSize,
                              opacity: 0.82,
                          },
                          showlegend: true,
                      };
                  })
                : [{
                      type: 'scatter',
                      mode: 'markers',
                      x: Y.map(v => v[0]),
                      y: Y.map(v => v[1]),
                      marker: { color: colors, size: markerSize, opacity: 0.82, colorscale: 'Rainbow' },
                      showlegend: false,
                  }];

            const isDark = isDarkMode();
            const axisDefaults = getPlotlyAxisDefaults(isDark);
            const graphPalette = getGraphPalette(isDark);
            const layout = mergePlotlyLayout({
                autosize: true,
                height: 480,
                xaxis: {
                    ...axisDefaults,
                    title: { text: 'Component 1', font: { size: 12 } },
                    zeroline: false,
                    showgrid: true,
                    mirror: true,
                },
                yaxis: {
                    ...axisDefaults,
                    title: { text: 'Component 2', font: { size: 12 } },
                    zeroline: false,
                    showgrid: true,
                    mirror: true,
                },
                paper_bgcolor: graphPalette.paperBg,
                plot_bgcolor: graphPalette.plotBg,
                margin: { t: 12, r: 16, b: 48, l: 54 },
                hovermode: 'closest',
                showlegend: is_classification,
                legend: embeddedLegend,
            }, isDark);

            const op = Plotly.react('tsne', traces, layout, {
                ...plotlyImageExportConfig,
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['select2d', 'lasso2d', 'resetScale2d'],
            });
            if (op && typeof op.then === 'function') await op;

        } else if (tsneComponents === 3) {
            /* ── True interactive 3D scatter ─────────────────────────────── */
            const axisStyle = {
                backgroundcolor: 'rgba(240,244,248,0.7)',
                gridcolor: 'rgba(148,163,184,0.4)',
                gridwidth: 1,
                zerolinecolor: 'rgba(148,163,184,0.6)',
                showspikes: false,
                tickfont: { size: 10, color: '#64748b' },
            };

            const traces3d = is_classification
                ? uniqueLabels.map((lab, k) => {
                      const mask = labels.map((l, r) => (l === lab ? r : -1)).filter(r => r >= 0);
                      return {
                          type: 'scatter3d',
                          mode: 'markers',
                          name: String(lab),
                          x: mask.map(r => Y[r][0]),
                          y: mask.map(r => Y[r][1]),
                          z: mask.map(r => Y[r][2]),
                          marker: {
                              color: this.indexToColor(k, uniqueLabels.length),
                              size: markerSize,
                              opacity: 0.85,
                              line: { width: 0 },
                          },
                          showlegend: true,
                          hovertemplate:
                              `<b>${String(lab)}</b><br>` +
                              'Comp 1: %{x:.2f}<br>Comp 2: %{y:.2f}<br>Comp 3: %{z:.2f}<extra></extra>',
                      };
                  })
                : [{
                      type: 'scatter3d',
                      mode: 'markers',
                      x: Y.map(v => v[0]),
                      y: Y.map(v => v[1]),
                      z: Y.map(v => v[2]),
                      marker: {
                          color: colors,
                          size: markerSize,
                          opacity: 0.85,
                          colorscale: 'Rainbow',
                          showscale: true,
                          line: { width: 0 },
                      },
                      showlegend: false,
                      hovertemplate: 'Comp 1: %{x:.2f}<br>Comp 2: %{y:.2f}<br>Comp 3: %{z:.2f}<extra></extra>',
                  }];

            const layout3d = {
                autosize: true,
                height: 540,
                scene: {
                    xaxis: { title: { text: 'Component 1', font: { size: 11 } }, ...axisStyle },
                    yaxis: { title: { text: 'Component 2', font: { size: 11 } }, ...axisStyle },
                    zaxis: { title: { text: 'Component 3', font: { size: 11 } }, ...axisStyle },
                    bgcolor: 'rgba(248,250,252,0.6)',
                    camera: { eye: { x: 1.4, y: 1.4, z: 0.9 } },
                    aspectmode: 'cube',
                },
                paper_bgcolor: 'rgba(0,0,0,0)',
                margin: { t: 0, r: 0, b: 0, l: 0 },
                hovermode: 'closest',
                showlegend: is_classification,
                legend: embeddedLegend,
            };

            const op3d = Plotly.react('tsne', traces3d, layout3d, {
                ...plotlyImageExportConfig,
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['resetCameraLastSave3d'],
            });
            if (op3d && typeof op3d.then === 'function') await op3d;

        } else {
            /* ── Grid of 2-D projections for n > 3 ──────────────────────── */
            const pairs = [];
            for (let i = 0; i < tsneComponents; i++) {
                for (let j = i + 1; j < tsneComponents; j++) {
                    pairs.push([i, j]);
                }
            }
            const nCols = Math.min(pairs.length, 3);
            const nRows = Math.ceil(pairs.length / nCols);
            const cellPx = 280;

            const traces = [];
            pairs.forEach(([ci, cj], idx) => {
                const axIdx = idx + 1;
                if (is_classification) {
                    uniqueLabels.forEach((lab, k) => {
                        const mask = labels.map((l, r) => (l === lab ? r : -1)).filter(r => r >= 0);
                        traces.push({
                            type: 'scatter',
                            mode: 'markers',
                            x: mask.map(r => Y[r][ci]),
                            y: mask.map(r => Y[r][cj]),
                            xaxis: `x${axIdx}`,
                            yaxis: `y${axIdx}`,
                            marker: { color: this.indexToColor(k, uniqueLabels.length), size: markerSize, opacity: 0.82 },
                            showlegend: false,
                        });
                    });
                } else {
                    traces.push({
                        type: 'scatter',
                        mode: 'markers',
                        x: Y.map(v => v[ci]),
                        y: Y.map(v => v[cj]),
                        xaxis: `x${axIdx}`,
                        yaxis: `y${axIdx}`,
                        marker: { color: colors, size: markerSize, opacity: 0.82, colorscale: 'Rainbow' },
                        showlegend: false,
                    });
                }
            });

            const layout = {
                width: nCols * cellPx + 40,
                height: nRows * cellPx + 40,
                showlegend: false,
                grid: { rows: nRows, columns: nCols, pattern: 'independent', xgap: 0.08, ygap: 0.1 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: mergePlotlyLayout({}, isDarkMode()).plot_bgcolor,
                margin: { t: 16, r: 16, b: 16, l: 16 },
            };
            pairs.forEach(([ci, cj], idx) => {
                const k = idx + 1;
                layout[`xaxis${k}`] = {
                    title: { text: `Comp ${ci + 1}`, font: { size: 10 } },
                    zeroline: false, showgrid: true, gridcolor: 'rgba(0,0,0,0.07)',
                    linecolor: '#94a3b8', mirror: true,
                };
                layout[`yaxis${k}`] = {
                    title: { text: `Comp ${cj + 1}`, font: { size: 10 } },
                    zeroline: false, showgrid: true, gridcolor: 'rgba(0,0,0,0.07)',
                    linecolor: '#94a3b8', mirror: true,
                };
            });

            const op = Plotly.react('tsne', traces, layout, {
                ...plotlyImageExportConfig,
                responsive: true,
                modeBarButtonsToRemove: ['select2d', 'lasso2d', 'resetScale2d'],
            });
            if (op && typeof op.then === 'function') await op;
        }

        return legendItems;
    }
    nrd(x) {
        let s = standardDeviation(x);
        const iqr = interquartileRange(x);
        if (typeof iqr === "number") {
            s = Math.min(s, iqr / 1.34);
        }
        return 1.06 * s * Math.pow(x.length, -0.2);
    }
    hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
            a: 0.5
        } : null;
    }
    kernelFunctions = {
        gaussian: function (u) {
            return Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
        },
        uniform: function (x) {
            return Math.abs(x) <= 1 ? 0.5 : 0;
        },
        triangular: function (x) {
            return Math.abs(x) <= 1 ? 1 - Math.abs(x) : 0;
        },
        biweight: function (x) {
            return Math.abs(x) <= 1 ? 15 / 16 * Math.pow(1 - x * x, 2) : 0;
        },
        triweight: function (x) {
            return Math.abs(x) <= 1 ? 35 / 32 * Math.pow(1 - x * x, 3) : 0;
        },
        Epanechnikov: function (x) {
            return Math.abs(x) <= 1 ? 0.75 * (1 - x * x) : 0;
        }
    };

    draw_kde(dataset, column, target_name, bandwidth = "nrd", is_classification = false, redrawing = false) {
        try {


            let items = dfColumn(dataset, column).values;
            let default_bandwidth = this.nrd(items).toFixed(2);
            let raw_values = dataset.loc({ columns: [column, target_name] });
            let uniqueLabels = [...new Set(dfColumn(raw_values, target_name).values)];
            if (uniqueLabels.length === 2) {
                uniqueLabels.sort()
            }
            let column_values = raw_values.values;
            let subsets = [];
            var colorIndices = uniqueLabels.map(label => this.indexToColor(uniqueLabels.indexOf(label), uniqueLabels.legend));
            if (!is_classification) {
                subsets.push(dataset[column].values);
            } else {
                for (let i = 0; i < uniqueLabels.length; i++) {
                    const label = uniqueLabels[i];
                    let subset = [];
                    for (let i = 0; i < column_values.length; i++) {
                        const item = column_values[i];
                        if (item[1] === label) {
                            subset.push(item[0])
                        }
                    }
                    subsets.push(subset);
                }
            }

            document.getElementById("kde_panel").style.display = "block";

            var newColumn = document.createElement("div");
            newColumn.className = "column is-3";
            newColumn.setAttribute("id", column + '-kde-plot');
            if (!redrawing) {
                let key = encode_name(column)

                $("#container").append(
                    `<div class="column is-4 is-size-6-tablet my-1">
                <div class="columns is-multiline">
                <div class="column is-12" >
                    <div id="${key + '-kde-plot'}"> </div>
                    <div id="${key + '-boxplot'}" style="height:20vh;width: 100%">
                    </div>
                    <div class="field has-addons has-addons-centered my-1">
                    <div class="control">
                    <span class="select is-small">
                      <select id="${key + '-kernel_type'}">
                      <option value="gaussian">gaussian</option>
                        <option value="uniform">uniform</option>
                        <option value="triangular">triangular</option>
                        <option value="biweight">biweight</option>
                        <option value="triweight">triweight</option>
                        <option value="Epanechnikov">Epanechnikov</option>
                      </select>
                    </span>
                    <p class="help is-success">Kernel</p>
                  </div>
                  <div class="control">
                        <div class="select is-small">
                            <select id="${key + '--normal'}">
                                <option value="0">No</option>
                                <option value="1">Scale</option>
                                <option value="2">x^2</option>
                                <option value="3">ln(x)</option>
                                <option value="4">Standardize </option>
                            </select>
                        </div>
                    <p class="help is-success">Normalization</p>
                    </div>
                        <div class="control">
                            <input class="input is-small" type="number"  min="0" id="${key + '-kde'}" value="${default_bandwidth}">
                            <p class="help is-success">Bandwidth</p>
                        </div>
                        <p class="control">
                            <a class="button is-success is-small" id="${key + '-kde-button'}">
                                Apply
                            </a>
                        </div>
                    </div>
                  </div>
                </div>`
                );
                document.getElementById(key + '--normal').addEventListener('change', function () {
                    const target = document.getElementById("target").value;
                    let is_classification = document.getElementById(target).value !== FeatureCategories.Numerical;
                    let data = dataset.loc({ columns: [column, target] });
                    let normalization_type = document.getElementById(key + '--normal').value
                    scale_data(data, column, normalization_type)
                    data.dropNa({ axis: 1, inplace: true })
                    var newBandwidth = parseFloat(document.getElementById(key + '-kde').value);
                    current_class.draw_kde(data, column, target, newBandwidth, is_classification, true);
                });
            }
            var current_class = this;
            let key = encode_name(column)

            document.getElementById(key + '-kde-button').addEventListener("click", function () {
                const target = document.getElementById("target").value;
                let is_classification = document.getElementById(target).value !== FeatureCategories.Numerical;
                let data = dataset.loc({ columns: [column, target] });
                let normalization_type = document.getElementById(key + '--normal').value
                scale_data(data, column, normalization_type)
                var newBandwidth = parseFloat(document.getElementById(key + '-kde').value);
                data.dropNa({ axis: 1, inplace: true })
                current_class.draw_kde(data, column, target, newBandwidth, is_classification, true);
            });
            let container_id = key + '-kde-plot';
            let items_range = [...dfColumn(raw_values, column).values]
            // let minValue = Math.min(...items_range);
            // let maxValue = Math.max(...items_range);
            // items_range.push(minValue - parseFloat(default_bandwidth))
            // items_range.push(maxValue + parseFloat(default_bandwidth))
            var breaks = equalIntervalBreaks(items_range, 100);
            let allData = [];
            let kernel_type = document.getElementById(key + "-kernel_type")?.value ?? "gaussian"
            // Loop through subsets to generate data for all subsets
            let traces = []
            let kde;
            if (is_classification) {
                for (let i = 0; i < subsets.length; i++) {
                    if (subsets[i].length > 2) {
                        let ys = [];
                        kde = kernelDensityEstimation(subsets[i], this.kernelFunctions[kernel_type], bandwidth);
                        let data = [];
                        breaks.forEach((item) => {
                            ys.push(kde(item, bandwidth));
                            data.push([item, ys[ys.length - 1]]);
                        });
                        allData.push(data);
                    } else {
                        allData.push([]);
                    }
                    traces.push({
                        name: uniqueLabels[i],
                        x: subsets[i],
                        marker: {
                            color: colorIndices[i]
                        },
                        type: 'box',
                    })
                }
            } else {
                for (let i = 0; i < subsets.length; i++) {
                    if (subsets[i].length > 2) {
                        let ys = [];
                        kde = kernelDensityEstimation(subsets[i], this.kernelFunctions[kernel_type], bandwidth);
                        let data = [];
                        breaks.forEach((item) => {
                            ys.push(kde(item, bandwidth));
                            data.push([item, ys[ys.length - 1]]);
                        });
                        allData.push(data);
                    } else {
                        allData.push([]);
                    }
                }
                traces.push({
                    name: column,
                    x: items,
                    type: 'box',
                })
            }

            let animationDuration = 4000;

            var layout = {

                yaxis: {
                    visible: false,
                },
                showlegend: false,
                margin: {
                    l: 20,
                    r: 10,
                    b: 60,
                    t: 10,
                },
                legend: {
                    x: 1,
                    xanchor: 'right',
                    y: 1
                },
            };
            window.Plotly.newPlot(key + '-boxplot', traces, layout, { autosize: true, responsive: true, modeBarButtonsToRemove: ['pan', 'resetScale2d', 'select2d', 'resetViews', 'sendDataToCloud', 'hoverCompareCartesian', 'lasso2d', 'drawopenpath '] });
            Highcharts.chart(container_id, {
                credits: {
                    enabled: false
                },
                legend: {
                    enabled: is_classification ? true : false, align: 'right',
                    verticalAlign: 'top',
                },
                chart: {
                    height: '300',
                    type: "spline",
                    animation: true,
                },
                title: {
                    text: column // Assuming `column` is defined elsewhere
                },
                yAxis: {
                    title: { text: null }
                },
                tooltip: {
                    valueDecimals: 3
                },
                plotOptions: {
                    series: {
                        marker: {
                            enabled: false
                        },
                        dashStyle: "shortdot",
                        color: colorIndices,
                        animation: {
                            duration: animationDuration
                        },
                        area: true
                    }
                },
                series: allData.map((data, index) => ({
                    type: 'area',
                    name: uniqueLabels[index],
                    dashStyle: "solid",
                    lineWidth: 2,
                    color: colorIndices[index],
                    data: data
                }))
            });
            window.dispatchEvent(new Event('resize'));
        } catch (error) {
            throw new Error('falied at plotting kde.')
        }
    }
    downloadPlot(container) {
        window.Plotly.toImage(container, {
            format: 'png',
            width: null,
            height: null,
            scale: 2
        }).then(function (dataUrl) {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'plot.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }
    async classificationPCA(dataset, labels, missclassifications, uniqueLabels, index, n) {
        labels = labels.flat()
        const pca = new PCA();
        var colorIndices = labels.map(label => this.indexToColor(uniqueLabels.indexOf(label), uniqueLabels.length));
        const pca_data = await pca.predict(dataset, n)
        let x = []
        let y = []
        let x_error = []
        let y_error = []
        let error_texts = []
        let real_labels = []
        let missclassificationColors = []
        let truePredsColors = []
        pca_data[0].forEach((element, i) => {
            if (missclassifications['indexes'].includes(i)) {
                let index = missclassifications['indexes'].findIndex(index => index == i)
                error_texts.push(dataset[i].join())
                real_labels.push([labels[i], missclassifications['mispredictions'][index]])
                x_error.push(element[0])
                y_error.push(element[1])
                missclassificationColors.push(colorIndices[i])
            } else {
                x.push(element[0])
                y.push(element[1])
                truePredsColors.push(colorIndices[i])
            }

        });
        var trace1 = {
            x: x,
            y: y,
            name: 'Predictions',
            text: labels,
            mode: 'markers',
            type: 'scatter',
            marker: {
                size: 4,
                color: truePredsColors,
                symbol: 'circle'
            },
        };
        var trace2 = {
            name: 'Missclassifications',
            x: x_error,
            y: y_error,
            text: error_texts,
            customdata: real_labels,
            mode: 'markers',
            type: 'scatter',
            marker: {
                size: 7,
                color: missclassificationColors,
                symbol: 'cross'
            },
            hovertemplate:
                "Features : %{text}<br>" +
                "True class: %{customdata[0]}<br>" +
                "Predited class: %{customdata[1]}" +
                "<extra></extra>"

        };
        var data = [trace1, trace2];

        window.Plotly.newPlot('pca_results_' + index, data, {
            title: {
                text: 'Principle Component Analysis of Predictions'
            },
            hovermode: "closest",
            hoverlabel: { bgcolor: "#FFF" },
            showlegend: true,
            legend: {
                x: 1,
                xanchor: 'right',
                y: 1,
                bgcolor: 'rgba(0,0,0,0)',

            },
            xaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                title: 'PC1'
            },
            yaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                title: 'PC2'
            }
        }, { ...plotlyImageExportConfig, staticPlot: false, responsive: true, modeBarButtonsToRemove: ['resetScale2d', 'select2d', 'resetViews', 'sendDataToCloud', 'hoverCompareCartesian', 'lasso2d', 'drawopenpath '] });

    }
    purge_charts(id) {
        window.Plotly.purge(id)
    }
    async draw_pca(dataset, is_classification, labels, numberOfComponents, axes, columns, drawScreePlot = false, seed = 42, scaleData = true) {
        const Plotly = await getPlotly();
        const isDark = isDarkMode();
        const graphPalette = getGraphPalette(isDark);
        const axisDefaults = getPlotlyAxisDefaults(isDark);
        const pca = new PCA();
        labels = labels.flat();
        // eslint-disable-next-line no-unused-vars
        const [pca_data, _, explained_variances, circels, distances] = await pca.predict(dataset, numberOfComponents, seed, [], scaleData);

        // Cap matrix to 2 PCs when doing the initial scree exploration
        const pcaComponents = drawScreePlot ? Math.min(2, pca_data[0].length) : pca_data[0].length;

        // Extract each PC column once
        const pcaCols = [];
        for (let c = 0; c < pcaComponents; c++) {
            pcaCols.push(pca_data.map(row => row[c]));
        }

        // Colour setup
        let uniqueLabels = [];
        let colors = [];
        let legendItems = [];
        if (is_classification) {
            uniqueLabels = [...new Set(labels)];
            const labelIndex = new Map(uniqueLabels.map((l, i) => [l, i]));
            colors = labels.map(l => this.indexToColor(labelIndex.get(l), uniqueLabels.length));
            legendItems = uniqueLabels.map((lab, k) => ({
                label: String(lab),
                color: this.indexToColor(k, uniqueLabels.length),
            }));
        } else {
            const max = labels.reduce((a, b) => a > b ? a : b);
            const min = labels.reduce((a, b) => a < b ? a : b);
            colors = labels.map(item => this.indexToColorSequential(item, min, max));
        }

        const markerSize = dataset.length > 1000 ? 3 : 5;

        // ── PCA Scatter Matrix ───────────────────────────────────────────
        const pca_traces = [];
        let index = 1;
        for (let i = 0; i < pcaComponents; i++) {
            for (let j = 0; j < pcaComponents; j++) {
                const varI = explained_variances[i] ? (explained_variances[i] * 100).toFixed(1) + '%' : '';
                const varJ = explained_variances[j] ? (explained_variances[j] * 100).toFixed(1) + '%' : '';
                pca_traces.push({
                    x: pcaCols[j],
                    y: pcaCols[i],
                    mode: 'markers',
                    type: 'scattergl',
                    xaxis: 'x' + index,
                    yaxis: 'y' + index,
                    marker: { color: colors, size: markerSize, opacity: 0.80 },
                    hovertemplate: `PC${j + 1}: %{x:.2f}<br>PC${i + 1}: %{y:.2f}<extra>${varJ} / ${varI}</extra>`,
                    showlegend: false,
                });
                index++;
            }
        }
        const cellPx = Math.max(130, Math.min(200, Math.floor(860 / pcaComponents)));
        const matrixLayout = mergePlotlyLayout({
            width: cellPx * pcaComponents + 48,
            height: cellPx * pcaComponents + 48,
            showlegend: false,
            grid: { rows: pcaComponents, columns: pcaComponents, pattern: 'independent', xgap: 0.06, ygap: 0.06 },
            paper_bgcolor: graphPalette.paperBg,
            plot_bgcolor: graphPalette.plotBg,
            font: { size: 11, color: graphPalette.text },
            margin: { t: 16, r: 16, b: 16, l: 16 },
        }, isDark);
        for (let i = 0; i < pcaComponents; i++) {
            for (let j = 0; j < pcaComponents; j++) {
                const k = i * pcaComponents + j + 1;
                const vJ = explained_variances[j] ? ` (${(explained_variances[j] * 100).toFixed(0)}%)` : '';
                const vI = explained_variances[i] ? ` (${(explained_variances[i] * 100).toFixed(0)}%)` : '';
                matrixLayout[`xaxis${k}`] = {
                    ...axisDefaults,
                    zeroline: true, zerolinecolor: graphPalette.zeroLine, zerolinewidth: 1,
                    showgrid: true,
                    mirror: true,
                    showticklabels: i === pcaComponents - 1,
                    title: i === pcaComponents - 1 ? { text: `PC${j + 1}${vJ}`, font: { size: 10, color: graphPalette.text } } : {},
                };
                matrixLayout[`yaxis${k}`] = {
                    ...axisDefaults,
                    zeroline: true, zerolinecolor: graphPalette.zeroLine, zerolinewidth: 1,
                    showgrid: true,
                    mirror: true,
                    showticklabels: j === 0,
                    title: j === 0 ? { text: `PC${i + 1}${vI}`, font: { size: 10, color: graphPalette.text } } : {},
                };
            }
        }
        const matOp = Plotly.react('pca_matrix', pca_traces, matrixLayout, {
            ...plotlyImageExportConfig, responsive: true, staticPlot: false,
        });
        if (matOp && typeof matOp.then === 'function') await matOp;

        // ── Biplot (correlation circle) ──────────────────────────────────
        const arrows = distances.map((_, i) => ({
            axref: 'x', x: circels[i][0],
            ayref: 'y', y: circels[i][1],
            ax: 0, ay: 0,
            xref: 'x', yref: 'y',
            arrowside: 'end',
            arrowcolor: this.indexToColor(i, distances.length),
            arrowwidth: 1.6,
            arrowhead: 4,
            arrowsize: 0.8,
        }));
        const labelAnnotations = distances.map((_, i) => ({
            x: circels[i][0] * 1.12,
            y: circels[i][1] * 1.12,
            xref: 'x', yref: 'y',
            text: columns[i],
            showarrow: false,
            font: { size: 9, color: this.indexToColor(i, distances.length) },
            xanchor: circels[i][0] >= 0 ? 'left' : 'right',
        }));
        const biplotOp = Plotly.react('correlation_circle', [{ x: [], y: [], type: 'scatter', mode: 'markers' }], mergePlotlyLayout({
            annotations: [...arrows, ...labelAnnotations],
            shapes: [{
                type: 'circle', xref: 'x', yref: 'y',
                x0: -1, y0: -1, x1: 1, y1: 1,
                line: { color: 'rgba(16,185,129,0.7)', width: 1.5 },
            }],
            showlegend: false,
            autosize: true, height: 360,
            margin: { l: 48, r: 16, b: 44, t: 12 },
            paper_bgcolor: graphPalette.paperBg,
            plot_bgcolor: graphPalette.plotBg,
            xaxis: {
                ...axisDefaults,
                range: [-1.3, 1.3], zeroline: true, zerolinecolor: graphPalette.zeroLine,
                mirror: true,
                title: { text: 'Loading on PC1', font: { size: 11, color: graphPalette.text } },
                showgrid: true,
                constrain: 'domain',
            },
            yaxis: {
                ...axisDefaults,
                range: [-1.3, 1.3], zeroline: true, zerolinecolor: graphPalette.zeroLine,
                mirror: true,
                title: { text: 'Loading on PC2', font: { size: 11, color: graphPalette.text } },
                showgrid: true,
                scaleanchor: 'x',
                scaleratio: 1,
                constrain: 'domain',
            },
        }, isDark), { ...plotlyImageExportConfig, responsive: true });
        if (biplotOp && typeof biplotOp.then === 'function') await biplotOp;

        // ── Scree plot (bars + cumulative line) ──────────────────────────
        if (drawScreePlot) {
            const cumulative = [];
            const compAxis = explained_variances.map((v, i) => {
                cumulative.push((cumulative[i - 1] || 0) + v);
                return i + 1;
            });
            const screeOp = Plotly.react('scree_plot', [
                {
                    name: 'Individual',
                    x: compAxis, y: explained_variances.map(v => +(v * 100).toFixed(2)),
                    type: 'bar',
                    marker: { color: explained_variances.map((_, i) => this.indexToColor(i, explained_variances.length)), opacity: 0.85 },
                    hovertemplate: 'PC%{x}: %{y:.1f}%<extra></extra>',
                },
                {
                    name: 'Cumulative',
                    x: compAxis, y: cumulative.map(v => +(v * 100).toFixed(2)),
                    type: 'scatter', mode: 'lines+markers',
                    line: { color: '#f59e0b', width: 2 },
                    marker: { color: '#f59e0b', size: 5 },
                    yaxis: 'y',
                    hovertemplate: 'PC%{x} cumulative: %{y:.1f}%<extra></extra>',
                },
            ], mergePlotlyLayout({
                autosize: true, height: 360,
                margin: { l: 52, r: 16, b: 44, t: 12 },
                paper_bgcolor: graphPalette.paperBg,
                plot_bgcolor: graphPalette.plotBg,
                barmode: 'group',
                legend: { orientation: 'h', x: 0, y: 1.08, font: { size: 10, color: graphPalette.text } },
                shapes: [
                    { type: 'line', x0: 0.5, x1: compAxis.length + 0.5, y0: 90, y1: 90, line: { color: '#ef4444', width: 1.5, dash: 'dashdot' } },
                    { type: 'line', x0: 0.5, x1: compAxis.length + 0.5, y0: 80, y1: 80, line: { color: '#10b981', width: 1.5, dash: 'dashdot' } },
                ],
                annotations: [
                    { x: compAxis.length, y: 90, xref: 'x', yref: 'y', text: '90%', showarrow: false, font: { size: 9, color: '#ef4444' }, xanchor: 'right' },
                    { x: compAxis.length, y: 80, xref: 'x', yref: 'y', text: '80%', showarrow: false, font: { size: 9, color: '#10b981' }, xanchor: 'right' },
                ],
                xaxis: {
                    ...axisDefaults,
                    tickmode: 'linear', dtick: 1,
                    mirror: true, zeroline: false,
                    showgrid: false,
                    title: { text: 'Number of PCs', font: { size: 11, color: graphPalette.text } },
                },
                yaxis: {
                    ...axisDefaults,
                    range: [0, 105],
                    mirror: true, zeroline: false,
                    showgrid: true,
                    title: { text: 'Explained variance (%)', font: { size: 11, color: graphPalette.text } },
                },
            }, isDark), { ...plotlyImageExportConfig, responsive: true });
            if (screeOp && typeof screeOp.then === 'function') await screeOp;
        }

        return [pca_data.map(item => Array.from(item)), explained_variances, legendItems];
    }
    // eslint-disable-next-line no-unused-vars
    drawStackedHorizontalChart() {
        var trace1 = {
            x: [20, 14, 23],
            y: ['giraffes', 'orangutans', 'monkeys'],
            name: 'SF Zoo',
            orientation: 'h',
            marker: {
                color: 'rgba(55,128,191,0.6)',
                width: 1
            },
            type: 'bar'
        };

        var trace2 = {
            x: [12, 18, 29],
            y: ['giraffes', 'orangutans', 'monkeys'],
            name: 'LA Zoo',
            orientation: 'h',
            type: 'bar',
            marker: {
                color: 'rgba(255,153,51,0.6)',
                width: 1
            }
        };

        var data = [trace1, trace2];

        var layout = {
            title: 'Colored Bar Chart',
            barmode: 'stack'
        };

        window.Plotly.newPlot('myDiv', data, layout);

    }
    regularization_plot(xs, ys, labels) {
        const traces = []
        labels.forEach((element, i) => {
            traces.push({
                x: xs,
                y: ys.map(m => m[i]),
                type: 'scatter',
                name: element,
                mode: 'line'
            })
        });
        var layout = {
            colorway: ['#f3cec9', '#e7a4b6', '#cd7eaf', '#a262a9', '#6f4d96', '#3d3b72', '#182844'],
            title: 'Lasso Coefficients as Alpha varies',
            xaxis: {
                type: 'log',
                title: 'Alpha (Regularization Strength)'
            },
            yaxis: {
                title: 'Coefficient Value'
            }
        };
        window.Plotly.newPlot('lasso_plot', traces, layout);
    }
    argmax(array) {
        return array.reduce((maxIndex, currentValue, currentIndex, array) => {
            return currentValue > array[maxIndex] ? currentIndex : maxIndex;
        }, 0);
    }
    probabilities_boxplot(probs, labels, uniqueLabels, index) {
        let traces = [];
        let probablitiesFormatted = []
        let subsets = {};
        labels.forEach((true_label, i) => {
            if (!(true_label in subsets)) {
                subsets[true_label] = [];
            }
            subsets[true_label].push(probs[i]);
        });
        for (const trueClass in subsets) {
            const classProbas = subsets[trueClass];
            classProbas.forEach((proba) => {
                const max = Math.max(...proba)
                probablitiesFormatted.push({
                    trueClass: trueClass,
                    predicted: proba.findIndex(prob => prob == max),
                    probablity: proba
                })
            })
        }
        let i = 0;
        let x = probablitiesFormatted.map(prob => prob.predicted);
        for (let true_label in subsets) {
            let classIndex = uniqueLabels.findIndex(m => m == true_label)
            traces.push({
                type: 'box',
                name: true_label,
                marker: {
                    color: this.indexToColor(classIndex, uniqueLabels.length),
                    size: 2,
                    line: {
                        outlierwidth: 0.3
                    }
                },
                line: {
                    width: 0.5
                },
                y: probablitiesFormatted.map(m => m.probablity[i]),
                x: x
            });
            i++;
        }
        // traces.forEach(trace => {
        //     trace['type'] = 'violin'
        // })
        // window.Plotly.newPlot("proba_violin_plot_" + index, traces, {
        //     xaxis: {
        //         linecolor: 'black',
        //         linewidth: 1,
        //         mirror: true,
        //     },
        //     yaxis: {
        //         title: 'Predicted Probability',
        //         linecolor: 'black',
        //         zeroline: false,
        //         linewidth: 1,
        //         mirror: true,
        //     },
        //     legend: {
        //         x: 1,
        //         xanchor: 'right',
        //         y: 1
        //     },
        //     violinmode: 'group'
        // }, { responsive: true });
        // traces.forEach(trace => {
        //     trace['type'] = 'box'
        // })
        window.Plotly.newPlot("proba_plot_" + index, traces, {
            xaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                title: 'class'
            },
            yaxis: {
                title: 'Predicted Probability',
                linecolor: 'black',
                zeroline: false,
                linewidth: 1,
                mirror: true,
            },
            legend: {
                x: 1,
                xanchor: 'right',
                y: 1,
                bgcolor: 'rgba(0,0,0,0)',

            },
            boxmode: 'group'
        }, { responsive: true });
    }
    // eslint-disable-next-line no-unused-vars

    async plotConfusionMatrix(y, predictedLabels, labels, uniqueClasses, tab_index) {
        await highChartLoader()
        const mtx = await confusionMatrix(y, predictedLabels, uniqueClasses.length);
        let metric = await ClassificationMetric(y.arraySync(), predictedLabels.arraySync(), uniqueClasses)
        let accuracy = metric.accuracy.toFixed(2);
        let f1Micro = metric.f1_micro.toFixed(2)
        let f1Macro = metric.f1_macro.toFixed(2)

        let len = mtx[0].length
        let preceissions = [];
        let recalls = [];
        for (let j = 0; j < len; j++) {
            preceissions.push(parseFloat(metric.precision[j].toFixed(2)))
        }
        for (let j = 0; j < len; j++) {
            recalls.push(parseFloat(metric.recall[j].toFixed(2)))
        }
        const metric_labels = ["Precession", "Recall", "F1 score", "Support"]
        labels.push("Precession")
        recalls.push(0)
        mtx.push(preceissions)
        let items_labels = labels.filter(x => !metric_labels.includes(x))
        let formatted_matrix = []
        for (let i = 0; i < mtx.length; i++) {
            const element = mtx[i];
            if (i < mtx.length - 1) {
                element.push(recalls[i])
            }
            for (let j = 0; j < element.length; j++) {
                const item = element[j];
                formatted_matrix.push([j, i, item])
            }
        }
        items_labels.push("Recall")

        Highcharts.chart("confusion_matrix_" + tab_index, {
            credits: {
                enabled: false
            },
            exporting: {
                enabled: true
            },
            chart: {
                type: 'heatmap',
                plotBorderWidth: 1
            },
            title: {
                text: '',
                style: {
                    fontSize: '0.75em'
                }
            },

            xAxis: [{
                categories: items_labels,
                title: {
                    text: 'Predicted Class'
                }
            }, {
                linkedTo: 0,
                opposite: true,
                tickLength: 0,
                labels: {
                    formatter: function () {
                        var chart = this.chart,
                            series = chart.series[0],
                            sum = 0,
                            x = this.value;

                        series.options.data.forEach(function (p) {
                            if (p[0] === x) {
                                if (p[1] < uniqueClasses.length) {
                                    sum += p[2];
                                }
                            }
                        });

                        return +sum.toFixed(2);
                    }
                }
            }],
            yAxis: [{
                categories: labels,
                title: {
                    text: 'Actual Class'
                },
                reversed: true, endOnTick: false
            }, {
                linkedTo: 0,
                opposite: true,
                tickLength: 0,
                labels: {
                    formatter: function () {
                        var chart = this.chart,
                            series = chart.series[0],
                            sum = 0,
                            x = this.value;
                        series.options.data.forEach(function (p) {
                            if (p[1] < uniqueClasses.length) {
                                if (p[1] === x) {
                                    if (p[0] < uniqueClasses.length) {
                                        sum += p[2];
                                    }

                                }
                            }
                        });
                        return +sum.toFixed(2);
                    }
                },
                title: null
            }],
            colorAxis: {
                min: 0,
                minColor: '#FFFFFF',
                maxColor: Highcharts.getOptions().colors[0]
            },
            legend: {
                enabled: false,
                align: 'center',
                layout: 'horizontal',
                margin: 0,
                verticalAlign: 'top',
                y: 5,
                symbolHeight: 10
            },
            series: [{
                name: '',
                borderWidth: 1,
                data: formatted_matrix,
                dataLabels: {
                    enabled: true,
                    useHTML: true,
                    color: '#000000',
                    formatter: function () {
                        var totalCount = this.series.data.reduce(function (acc, cur, i) {
                            if ((i + 1) % (uniqueClasses.length + 1) === 0) {
                                return acc
                            }
                            return +(acc + cur?.value).toFixed(2);
                        }, 0);
                        var count = this.point.value;
                        var skip = this.point.index >= this.series.data.length - (1 * (uniqueClasses.length + 1));

                        if (!skip && !((this.point.index + 1) % (uniqueClasses.length + 1) === 0)) {
                            var percentage = +((count / totalCount) * 100).toFixed(2);
                            return '<p style="margin:auto; text-align:center;">' + (+count.toFixed(2)) + '<br/>(' + (+percentage).toFixed(2) + '%)</p> ';
                        } else {
                            return '<p style="margin:auto; text-align:center;">' + (+count.toFixed(2)) + '</p>';
                        }
                    }
                }
            }],
            responsive: {
                rules: [{
                    condition: {
                        maxWidth: 200
                    },
                    chartOptions: {
                        yAxis: {
                            labels: {
                                format: '{substr value 0 1}',
                                padding: 0,
                                style: {
                                    fontSize: '6px'
                                }
                            }
                        }
                    }
                }]
            }
        });
        return [accuracy, f1Micro, f1Macro]
    }




    async plot_regularization(weights, alphas, names, tab_index) {
        await highChartLoader()
        let content = `
                    <div class="column is-6" id="regularization_${tab_index}" style="height: 40vh;">
                    </div>
    `
        $("#tabs_info li[data-index='" + tab_index + "'] #results_" + tab_index + "").append(content);

        let serieses = []
        for (let i = 0; i < names.length; i++) {
            serieses.push({
                name: names[i],
                data: weights.map(m => m[i])
            })
        }
        const alphas_formatted = [];
        for (let i = 0; i < alphas.length; i++) {
            alphas_formatted.push(alphas[i].toFixed(2));
        }
        Highcharts.chart("regularization_" + tab_index, {

            title: {
                text: '',
            },
            yAxis: {
                title: {
                    text: 'Coefficients'
                }
            },
            xAxis: {
                title: {
                    text: 'penalty weight'
                },
                categories: alphas_formatted,
            },
            legend: {
                layout: 'vertical',
                align: 'right',
                verticalAlign: 'middle'
            },

            plotOptions: {
                series: {
                    label: {
                        connectorAllowed: false
                    },
                }
            },
            series: serieses,
            responsive: {
                rules: [{
                    condition: {
                        maxWidth: 500
                    },
                    chartOptions: {
                        legend: {
                            layout: 'horizontal',
                            align: 'center',
                            verticalAlign: 'bottom'
                        }
                    }
                }]
            }
        });
    }
    yhat_plot(y_test, predictions, container, title = '') {
        window.Plotly.newPlot(container, [{
            x: y_test,
            y: predictions,
            type: 'scatter',
            name: "Predicted",
            mode: 'markers',
            marker: {
                color: 'blue',
                size: 4
            },
        }, {
            x: y_test,
            y: y_test,
            mode: 'lines',
            type: 'scatter',
            line: { color: 'red', dash: 'solid' },
            name: 'Perfect fit'
        }], {
            autosize: true,
            height: 300,
            title: {
                text: title,
                font: { size: 14 },
                xref: 'paper',
                x: 0.05,
            },
            showlegend: true,
            legend: { orientation: 'h', y: -0.25 },
            xaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                title: { text: 'Actual (y)', font: { size: 12 } },
            },
            yaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                title: { text: 'Predicted', font: { size: 12 } }
            },
            margin: { l: 50, r: 15, b: 55, t: 40, pad: 0 }
        }, {
            responsive: true, staticPlot: false, ...plotlyImageExportConfig
        });
    }
    comparison(x, y, container, title = '', yLabel = '') {
        window.Plotly.newPlot(container, [{
            x: x,
            y: y,
            type: 'scatter',
            name: "y",
            mode: 'line',
            marker: {
                color: 'blue',
                size: 4
            },
        }], {
            height: 300,
            width: 300,
            title: {
                text: title,
                font: {
                    size: 14
                },
                xref: 'paper',
                x: 0.05,
            },
            showlegend: false,
            xaxis: {
                linecolor: 'black',
                tickangle: -45,
                linewidth: 1,
                mirror: true,
                title: {
                    font: {
                        size: 14,
                    }
                },
            },
            yaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                title: {
                    text: yLabel,
                    font: {
                        size: 14,
                    }
                }
            },
            margin: {
                l: 40,
                r: 10,
                b: 80,
                t: 40,
                pad: 0
            }
        }, {
            responsive: true, staticPlot: false, ...plotlyImageExportConfig
        });
    }
    residual_plot(y, residuals, container, title = '') {
        window.Plotly.newPlot(container, [
            {
                x: y,
                y: residuals,
                type: 'scatter',
                name: "Residuals",
                mode: 'markers',
                marker: { color: 'blue', size: 4 },
            },
            {
                x: y,
                y: y.map(() => 0),
                mode: 'lines',
                type: 'scatter',
                line: { color: 'red', dash: 'dash' },
                name: 'Zero line'
            }
        ], {
            autosize: true,
            height: 300,
            title: {
                text: title,
                font: { size: 14 },
                xref: 'paper',
                x: 0.05,
            },
            showlegend: false,
            xaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                title: { text: 'Fitted values', font: { size: 12 } },
            },
            yaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                title: { text: 'Residuals', font: { size: 12 } }
            },
            margin: { l: 50, r: 15, b: 55, t: 40, pad: 0 }
        }, { responsive: true, ...plotlyImageExportConfig, staticPlot: false });
    }

    /**
     * SPLOM: numeric columns in `items` only; `labels` must align row-wise (classification target).
     * Optional `targetColumnName` labels the extra row/column when classification + labels are valid.
     */
    async ScatterplotMatrix(
        items,
        features,
        labels,
        number_of_categoricals,
        is_classification = true,
        numeric_columns,
        categorical_columns,
        targetColumnName = 'Class',
        extendTargetMargins = false,
        options = {}
    ) {
        const Plotly = await getPlotly();
        const name =
            typeof targetColumnName === 'string' && targetColumnName.length
                ? targetColumnName
                : 'Class';
        let traces;
        let layout;
        try {
            const built = buildScatterplotMatrixTracesAndLayout(
                this,
                items,
                features,
                labels,
                is_classification,
                name,
                extendTargetMargins,
                isDarkMode()
            );
            traces = built.traces;
            layout = built.layout;
            if (built.error || !layout) {
                console.warn('ScatterplotMatrix:', built.error || 'empty layout');
                return;
            }
        } catch (e) {
            console.warn('ScatterplotMatrix build failed:', e);
            return;
        }

        const plotEl = typeof document !== 'undefined' ? document.getElementById('scatterplot_mtx') : null;
        const canReact = options.skipPurge && plotEl?.data?.length;

        if (!canReact) {
            try {
                Plotly.purge('scatterplot_mtx');
            } catch {
                /* ignore */
            }
        }

        const reactOp = Plotly.react('scatterplot_mtx', traces, layout, {
            responsive: true,
            ...plotlyImageExportConfig,
            staticPlot: false,
            modeBarButtonsToRemove: [
                'resetScale2d',
                'select2d',
                'resetViews',
                'sendDataToCloud',
                'hoverCompareCartesian',
                'lasso2d',
                'drawopenpath ',
            ],
        });
        if (reactOp && typeof reactOp.then === 'function') {
            try {
                await reactOp;
            } catch (e) {
                console.warn('ScatterplotMatrix Plotly.react failed:', e);
            }
        }
    }

    KNNPerformancePlot(results, best_n, id, label = "Accuracy") {
        let traces = []
        traces.push({
            x: results.map(m => m[1]),
            y: results.filter(n => n[0] === 'manhattan').map(m => Number(m[2])),
            mode: 'lines',
            name: 'manhattan test set',
            line: {
                color: 'rgb(55, 128, 191)',
                width: 2
            }
        });

        traces.push({
            x: results.map(m => m[1]),
            y: results.filter(n => n[0] === 'euclidean').map(m => Number(m[2])),
            mode: 'lines',
            name: 'euclidean test set',
            line: {
                color: 'rgb(219, 64, 82)',
                width: 2
            }
        });

        var layout = {
            showlegend: true,
            legend: {
                x: 0.1,
                y: 0.2,
                traceorder: 'normal',
                orientation: "h",
                font: {
                    size: 12,
                },
                bgcolor: 'rgba(0,0,0,0)',
            },
            xaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                title: {
                    text: 'K',
                },
            },
            yaxis: {
                range: [0, 1],
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                title: {
                    text: label,
                }
            },
            shapes: [
                {
                    type: 'line',
                    x0: best_n,
                    y0: 0,
                    x1: best_n,
                    y1: 1,
                    line: {
                        dash: 'dot',
                        color: 'rgb(55, 128, 191)',
                        width: 1
                    }
                },]
        };
        window.Plotly.newPlot("knn_table_" + id, traces, layout, { responsive: true });
    }
    KNNPerformancePlotRegression(results, optimalTrainSpec, optimalTestSpec, id) {
        let traces = []
        traces.push({
            x: results.map(m => m.k),
            y: results.filter(n => n.metric === 'manhattan').map(m => Number((m.evaluation).toFixed(2))),
            mode: 'lines',
            name: 'manhattan test set',
            line: {
                color: 'rgb(55, 128, 191)',
                width: 2
            }
        });

        traces.push({
            x: results.map(m => m.k),
            y: results.filter(n => n.metric === 'euclidean').map(m => Number((m.evaluation).toFixed(2))),
            mode: 'lines',
            name: 'euclidean test set',
            line: {
                color: 'rgb(219, 64, 82)',
                width: 2
            }
        });
        traces.push({
            x: results.map(m => m.k),
            y: results.filter(n => n.metric === 'manhattan').map(m => Number((m.evaluation_train).toFixed(2))),
            mode: 'lines',
            name: 'manhattan train set',
            line: {
                color: 'rgb(55, 128, 191)',
                width: 1
            }
        });
        traces.push({
            x: results.map(m => m.k),
            y: results.filter(n => n.metric === 'euclidean').map(m => Number((m.evaluation_train).toFixed(2))),
            mode: 'lines',
            name: 'euclidean train set',
            line: {
                color: 'rgb(219, 64, 82)',
                width: 1
            }
        });
        var min_y = Number.POSITIVE_INFINITY;
        var max_y = Number.NEGATIVE_INFINITY;
        traces.forEach(trace => {
            let min = Math.min(...trace.y)
            let max = Math.max(...trace.y)
            if (min < min_y) {
                min_y = min
            }
            if (max > max_y) {
                max_y = max
            }

        })
        var layout = {
            showlegend: true,
            legend: {
                x: 0.1,
                y: 0.2,
                traceorder: 'normal',
                orientation: "h",
                font: {
                    size: 10,
                },
                bgcolor: 'rgba(0,0,0,0)',
            },
            xaxis: {
                title: {
                    text: 'K',
                },
            },
            yaxis: {
                title: {
                    text: 'MSE',
                }
            },
            shapes: [
                {
                    type: 'line',
                    x0: optimalTrainSpec.k,
                    y0: min_y,
                    x1: optimalTrainSpec.k,
                    y1: max_y,
                    line: {
                        color: 'rgb(55, 128, 191)',
                        width: 1
                    }
                }, {
                    type: 'line',
                    x0: optimalTestSpec.k,
                    y0: min_y,
                    x1: optimalTestSpec.k,
                    y1: max_y,
                    line: {
                        color: 'rgb(55, 128, 191)',
                        width: 1
                    }
                },]
        };
        window.Plotly.newPlot("knn_table_" + id, traces, layout);
    }
    correaltoinMatrixColorscale(correlations) {
        let featuresCount = correlations[0].length;
        let corrs = [];

        for (let i = 0; i < featuresCount; i++) {
            corrs.push(...correlations[i])
        }
        corrs.sort()
        let countNegatives = 0
        for (let i = 0; i < corrs.length; i++) {
            if (corrs[i] < 0) {
                countNegatives += 1
            } else {
                break
            }
        }

        let portionOfNegativeValues = Math.round(((countNegatives - 1) / corrs.length) * 100) / 100

        let colorscale = [
            [0, 'rgb(0, 0, 100)'],
            [portionOfNegativeValues, 'rgb(161, 161, 255)'],
            [portionOfNegativeValues + 0.001, 'rgb(253, 237, 237)'],
            [1.0, 'rgb(255, 0, 0)']
        ]
        return colorscale
    }
    async correlationHeatmap(id, correlations, names) {

        var data = [
            {
                z: correlations,
                x: names,
                y: names,
                type: 'heatmap',
                zmin: -1,
                zmax: 1,
                hoverongaps: false,
                colorscale: [
                    [0, 'rgb(74,141,255)'],
                    [0.10, 'rgb(102,151,255)'],
                    [0.20, 'rgb(121,170,255)'],
                    [0.30, 'rgb(137,187,255)'],
                    [0.40, 'rgb(205,221,255)'],
                    [0.50, 'rgb(255,255,255)'],
                    [0.51, 'rgb(253, 237, 237)'],
                    [0.6, 'rgb(255,169,169)'],
                    [0.75, 'rgb(249,100,100)'],
                    [0.95, 'rgb(225,0,0)'],
                    [1.0, 'rgb(165,0,0)']
                ],
                showscale: false,
            }
        ];
        var layout = {

            annotations: [],
            font: {
                size: 10
            },
            xaxis: {
                ticks: '',
                side: 'bottom',
                tickangle: -90,
            },
            yaxis: {
                autorange: "reversed",
                tickangle: -45,
                ticks: '',
                ticksuffix: ' ',
            },
            autosize: true,

        };
        for (var i = 0; i < names.length; i++) {
            for (var j = names.length - 1; j >= 0; j--) {
                var currentValue = correlations[i][j];
                let textColor
                if (currentValue <= 0.0) {
                    textColor = 'black';
                } else {
                    textColor = 'black';
                }
                var result = {
                    xref: 'x1',
                    yref: 'y1',
                    x: names[i],
                    y: names[j],
                    text: currentValue.toFixed(2),
                    font: {
                        family: 'Arial',
                        size: 8,
                        color: textColor
                    },
                    showarrow: false,
                };
                layout.annotations.push(result);
            }
        }

        await window.Plotly.newPlot(id, data, layout, { ...plotlyImageExportConfig, responsive: true });
    }
    async dendogramPlot(id, correlations, linkage, names, originalColumns) {

        var trace4 = {
            x: names,
            y: names,
            z: correlations,
            type: 'heatmap',
            zmin: -1,
            zmax: 1,
            hoverongaps: false,
            colorscale: [
                [0, 'rgb(74,141,255)'],
                [0.10, 'rgb(102,151,255)'],
                [0.20, 'rgb(121,170,255)'],
                [0.30, 'rgb(137,187,255)'],
                [0.40, 'rgb(205,221,255)'],
                [0.50, 'rgb(255,255,255)'],
                [0.51, 'rgb(253, 237, 237)'],
                [0.6, 'rgb(255,169,169)'],
                [0.75, 'rgb(249,100,100)'],
                [0.95, 'rgb(225,0,0)'],
                [1.0, 'rgb(165,0,0)']
            ],
            xaxis: 'x',
            yaxis: 'y',
            colorbar: {
                thickness: 10,
                len: 0.5,
            }
        };
        let indices = []
        let linksLength = linkage.length + 1;
        let currentLimitY = 0;
        let prevLimitY = 0;
        let clusterY = 0
        let clusterX = 0
        for (let i = 0; i < originalColumns.length; i++) {
            indices.push(names.findIndex(name => name == originalColumns[i]))
        }
        let tickValues = []
        for (let i = 0; i < linksLength; i++) {
            tickValues.push((i + 1) * 10)
        }

        let dendrogramUP = {
            'data': [],
            'layout': {
                'width': '100%', 'showlegend': false,
                'xaxis': {
                    'showticklabels': true, 'tickmode': 'array', 'ticks': 'outside',
                    'showgrid': false, 'mirror': 'allticks', 'zeroline': false, 'showline': true, 'rangemode': 'tozero',
                    'type': 'linear'
                }, 'yaxis': {
                    'showticklabels': true, 'ticks': 'outside', 'showgrid': false, 'mirror': 'allticks', 'zeroline':
                        false, 'showline': true, 'rangemode': 'tozero', 'type': 'linear'
                }, 'hovermode': 'closest', 'autosize': false, 'height': '100%'
            }
        }

        let dendrogramRIGHT = {
            'data': [],
            'layout': {
                'width': '100%', 'showlegend': false,
                'xaxis': {
                    'showticklabels': true, 'ticks': 'outside', 'showgrid': false, 'mirror': 'allticks', 'zeroline': false, 'showline': true,
                    'rangemode': 'tozero', 'type': 'linear'
                }, 'yaxis': {
                    'showticklabels': true, 'tickmode': 'array', 'ticks': 'outside', 'showgrid': false,
                    'mirror': 'allticks', 'zeroline': false, 'showline': true, 'rangemode': 'tozero',
                    'type': 'linear'
                }, 'hovermode': 'closest', 'autosize': false,
                'height': '100%'
            }
        }
        let history = {}

        linkage.forEach((link, i) => {
            let l0, l1;
            if (indices[link[0]] + 1) {
                l0 = indices[link[0]] + 1 ?? link[0] + 1
            }
            if (indices[link[1]] + 1) {
                l1 = indices[link[1]] + 1 ?? link[1] + 1
            }
            if (currentLimitY == 0) {
                currentLimitY = (parseFloat(i + 1) / linksLength);
            }
            if (l0 <= linksLength && l1 <= linksLength) {
                clusterX = ((l0 * (Math.max(...tickValues) / linksLength) + l1 * (Math.max(...tickValues) / linksLength)) / 2)
                dendrogramUP.data.push({
                    'yaxis': 'y2', 'x': [l0 * 10, l0 * 10, l1 * 10, l1 * 10],
                    'mode': 'lines', 'xaxis': 'x', 'marker': { 'color': `${this.indexToColor(i)}` },
                    'y': [
                        prevLimitY, currentLimitY,
                        currentLimitY, prevLimitY
                    ],
                    'type': 'scatter'
                })

            } else {
                prevLimitY = l0 <= linksLength ? currentLimitY : history[link[0]]?.y_current;
                currentLimitY = (parseFloat(i + 1) / linksLength);
                let x = [
                    (l0 <= linksLength ? l0 * 10. : history[link[0]]?.x),
                    (l0 <= linksLength ? l0 * 10. : history[link[0]]?.x),
                    (l1 <= linksLength ? l1 * 10. : history[link[1]]?.x),
                    (l1 <= linksLength ? l1 * 10. : history[link[1]]?.x),
                ]
                let y = [
                    history[link[0]]?.y_current ?? 0, currentLimitY,
                    currentLimitY, history[link[1]]?.y_current ?? 0
                ]
                dendrogramUP.data.push({
                    'yaxis': 'y2', 'x': x,
                    'mode': 'lines', 'xaxis': 'x', 'marker': { 'color': `${this.indexToColor(i)}` },
                    'y': y,
                    'type': 'scatter'
                })
                clusterX = x.reduce((prev, curr) => prev + curr, 0) / 4;

            }
            history[linksLength + i] = { x: clusterX, y_current: currentLimitY }

        })



        let currentLimitX = 0;
        let prevLimitX = 0;
        history = []
        linkage.forEach((link, i) => {
            let l0 = indices[link[0]] + 1
            let l1 = indices[link[1]] + 1

            if (currentLimitX == 0) {
                currentLimitX = (parseFloat(i + 1) / linksLength);
            }
            if (l0 <= linksLength && l1 <= linksLength) {
                clusterY = ((l0 * -10 + l1 * -10) / 2) - 2
                dendrogramRIGHT.data.push({
                    'yaxis': 'y', 'y': [l0 * -10, l0 * -10, l1 * -10, l1 * -10],
                    'mode': 'lines', 'xaxis': 'x2', 'marker': { 'color': `${this.indexToColor(i)}` },
                    'x': [
                        prevLimitX, currentLimitX,
                        currentLimitX, prevLimitX
                    ],
                    'type': 'scatter'
                })
            } else {
                prevLimitX = l0 <= linksLength ? currentLimitX : history[link[0]].x;
                currentLimitX = (parseFloat(i + 1) / linksLength);
                let y = [
                    (l0 <= linksLength ? l0 * -10. : history[link[0]]?.y),
                    (l0 <= linksLength ? l0 * -10. : history[link[0]]?.y),
                    (l1 <= linksLength ? l1 * -10. : history[link[1]]?.y),
                    (l1 <= linksLength ? l1 * -10. : history[link[1]]?.y),
                ]
                dendrogramRIGHT.data.push({
                    'yaxis': 'y', 'y': y,
                    'mode': 'lines', 'xaxis': 'x2', 'marker': { 'color': `${this.indexToColor(i)}` },
                    'x': [
                        history[link[0]]?.x ?? 0, currentLimitX,
                        currentLimitX, history[link[1]]?.x ?? 0
                    ],
                    'type': 'scatter'
                })
                clusterY = y.reduce((prev, curr) => prev + curr, 0) / 4
            }
            history[linksLength + i] = { y: clusterY, x: currentLimitX }
        })

        var layout2 = {
            annotations: [],
            font: {
                size: 10
            },
            autosize: true,

            yaxis: {
                domain: [0, 0.75],
                mirror: false,
                showgrid: false,
                showline: false,
                zeroline: false,
                showticklabels: true,
                ticks: "",
                tickvals: tickValues.map(tick => -tick),
                ticktext: names,
                tickangle: -45,

            },
            xaxis: {
                domain: [0, 0.75],
                mirror: false,
                showgrid: false,
                showline: false,
                zeroline: false,
                showticklabels: true,
                ticks: "",
                tickvals: tickValues,
                ticktext: names,
                tickangle: -90,

            },
            xaxis2: {
                domain: [0.75, 1],
                mirror: false,
                showgrid: false,
                showline: false,
                zeroline: false,
                showticklabels: false,
                ticks: "",
                ticktext: names,
            },
            yaxis2: {
                domain: [0.75, 1],
                mirror: false,
                showgrid: false,
                showline: false,
                zeroline: false,
                showticklabels: false,
                ticktext: names,
            },
            showlegend: false,
            coloraxis: {
                colorscale: 'YlGnBu',
                showscale: true,
                cmin: -1,
                cmax: 1
            },
            margin: { l: 60, r: 30, b: 60, t: 30 },

        };
        for (var i = 0; i < names.length; i++) {
            for (var j = names.length - 1; j >= 0; j--) {
                var currentValue = correlations[i][j];
                let textColor
                if (currentValue <= 0.0) {
                    textColor = 'black';
                } else {
                    textColor = 'black';
                }
                var result = {
                    xref: 'x',
                    yref: 'y',
                    x: tickValues[i],
                    y: -tickValues[j],
                    text: currentValue.toFixed(2),
                    font: {
                        family: 'Arial',
                        size: 8,
                        color: textColor
                    },
                    showarrow: false,
                };
                layout2.annotations.push(result);
            }
        }
        let data = dendrogramUP['data']
        data = data.concat(dendrogramRIGHT['data'])

        trace4['x'] = tickValues
        trace4['y'] = tickValues.map(tick => -tick)

        data = data.concat(trace4)

        window.Plotly.newPlot(id, data, layout2, { ...plotlyImageExportConfig, responsive: true });
    }
    PFIBoxplot(id, importances, columns) {
        let traces = []
        let avgs = []
        importances.forEach(importance => {
            const importancesMean = importance.reduce((a, b) => a + b, 0)
            avgs.push((importancesMean / importance.length))
        });

        importances.forEach((importance, index) => {

            traces.push(
                {
                    x: Array.from(importance),
                    type: 'box',
                    name: columns[index],
                    marker: { color: this.indexToColor(index, importances.length) },
                }
            )
        });
        var layout = {
            title: {
                text: 'Permutation Feature Importance',
                font: {
                    size: 14
                },
                xref: 'paper',
                x: 0.05,
            },
            showlegend: false,
            xaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                zeroline: false,

            },
            yaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                automargin: true,
                zeroline: false,

            },
        };

        window.Plotly.newPlot('pfi_boxplot_' + id, traces, layout, { responsive: true });
    }
    plotPDP(id, averages, grids, labels, columns, categorical_columns) {
        const isArrayLike = (value) => Array.isArray(value) || ArrayBuffer.isView(value);
        const toPlainArray = (value) => {
            if (Array.isArray(value)) return value;
            if (ArrayBuffer.isView(value)) return Array.from(value);
            if (value && typeof value[Symbol.iterator] === "function") return Array.from(value);
            return [];
        };
        const toNumericArray = (values) => {
            if (!values) return [];
            const arr = toPlainArray(values);
            return arr.map((v) => Number(v)).filter((v) => Number.isFinite(v));
        };
        const normalizeCurve = (curve) => {
            if (!curve) return [];
            const base = toPlainArray(curve);
            if (base.length > 0 && isArrayLike(base[0])) {
                return toNumericArray(base[0]);
            }
            return toNumericArray(base);
        };

        let pfiChartId = 'pdp_containers_' + id;
        id = 'pdp_plot_' + id
        document.querySelectorAll(`[id^="${id}_"]`).forEach(node => node.remove());
        const categoricalSet = new Set(Array.isArray(categorical_columns) ? categorical_columns : []);
        const mountPoint = document.getElementById(pfiChartId);
        if (!mountPoint || !mountPoint.parentNode) {
            console.warn(`PDP mount point not found: ${pfiChartId}`);
            return;
        }

        grids.forEach((grid, i) => {
            let chartContainer = document.createElement("div");
            chartContainer.classList.add("column", "is-6");
            let chartId = id + '_' + i;
            chartContainer.id = chartId
            chartContainer.style.height = "400px";
            mountPoint.parentNode.insertBefore(chartContainer, mountPoint.nextSibling)
            let traces = []
            const isCategorical = categoricalSet.has(columns[i])
            const rawAverages = averages[i]
            const xValues = toNumericArray(grid)
            if (!rawAverages || xValues.length === 0) {
                return
            }
            const curveContainer = toPlainArray(rawAverages);
            const classCurves = curveContainer.length > 0 && isArrayLike(curveContainer[0]) ? curveContainer : [rawAverages]
            const curveCount = classCurves.length || 1;
            classCurves.forEach((average, index) => {
                let yValues = normalizeCurve(average);
                if (!yValues || yValues.length === 0) {
                    return
                }
                if (yValues.length !== xValues.length) {
                    const len = Math.min(yValues.length, xValues.length);
                    if (len <= 0) return;
                    yValues = yValues.slice(0, len);
                }
                const plotX = xValues.slice(0, yValues.length);
                if (isCategorical) {
                    traces.push(
                        {
                            x: plotX,
                            y: yValues,
                            type: 'bar',
                            name: labels[index] ?? `class_${index}`,
                            marker: { color: this.indexToColor(index, curveCount) }
                        }
                    )
                } else {
                    traces.push(
                        {
                            x: plotX,
                            y: yValues,
                            mode: 'lines',
                            line: { width: 2 },
                            name: labels[index] ?? `class_${index}`,
                            marker: { color: this.indexToColor(index, curveCount) }
                        }
                    )
                }

            });
            if (traces.length === 0) {
                return
            }
            var layout = {

                title: {
                    text: 'Partial Dependence Plot - ' + columns[i],
                    font: {
                        size: 14
                    },
                    xref: 'paper',
                    x: 0.05,
                },
                legend: { "orientation": "h" },

                font: {
                    size: 10
                },
                autosize: true,
                xaxis: {
                    linecolor: 'black',
                    linewidth: 1,
                    mirror: true,
                    zeroline: false,
                },
                yaxis: {
                    linecolor: 'black',
                    zeroline: false,
                    linewidth: 1,
                    mirror: true,
                    title: {
                        text: 'Prediction',
                    }
                },
            };

            window.Plotly.newPlot(chartId, traces, layout, { ...plotlyImageExportConfig, responsive: true });
        });
    }
    async plotPDPRegression(id, averages, grids, labels, columns, categoricals) {
        const pfiChartId = 'pfi_boxplot_' + id;
        const mountPoint = document.getElementById(pfiChartId);
        if (!mountPoint || !mountPoint.parentNode) {
            console.warn(`Regression PDP mount point not found: ${pfiChartId}`);
            return;
        }

        const toPlainArray = (value) => {
            if (Array.isArray(value)) return value;
            if (ArrayBuffer.isView(value)) return Array.from(value);
            if (value && typeof value[Symbol.iterator] === "function") return Array.from(value);
            return [];
        };
        const toNumericArray = (value) =>
            toPlainArray(value).map((v) => Number(v)).filter((v) => Number.isFinite(v));

        const chartId = id + '_number';
        const chartIdCategorical = id + '_class';
        document.getElementById(chartId)?.remove();
        document.getElementById(chartIdCategorical)?.remove();

        const numericalContainer = document.createElement("div");
        numericalContainer.classList.add("column", "is-6");
        numericalContainer.id = chartId;
        numericalContainer.style.height = "400px";
        mountPoint.parentNode.insertBefore(numericalContainer, mountPoint.nextSibling);

        const categoricalContainer = document.createElement("div");
        categoricalContainer.classList.add("column", "is-6");
        categoricalContainer.id = chartIdCategorical;
        categoricalContainer.style.height = "400px";
        mountPoint.parentNode.insertBefore(categoricalContainer, numericalContainer.nextSibling);

        let traces = [];
        let traces_categoricals = [];
        const categoricalSet = new Set(Array.isArray(categoricals) ? categoricals : []);
        (grids || []).forEach((grid, i) => {
            const featureName = columns?.[i] ?? `feature_${i}`;
            const avgSeries = toPlainArray(averages?.[i]);
            const curves = avgSeries.length > 0 && (Array.isArray(avgSeries[0]) || ArrayBuffer.isView(avgSeries[0]))
                ? avgSeries
                : [averages?.[i]];
            if (curves.length === 0) {
                return;
            }
            const isCategorical = categoricalSet.has(featureName);
            const xRaw = toPlainArray(grid);
            const xNumeric = toNumericArray(grid);

            curves.forEach((average) => {
                const yValues = toNumericArray(average);
                if (!yValues.length) return;
                const xSource = isCategorical ? xRaw : xNumeric;
                if (!xSource.length) return;
                const len = Math.min(xSource.length, yValues.length);
                const xValues = xSource.slice(0, len);
                const yPlot = yValues.slice(0, len);
                if (isCategorical) {
                    traces_categoricals.push({
                        x: xValues,
                        y: yPlot,
                        type: 'bar',
                        name: featureName,
                        marker: { color: this.indexToColor(i, Math.max((grids || []).length, 1)), opacity: 0.7 }
                    });
                } else {
                    traces.push({
                        x: xValues,
                        y: yPlot,
                        mode: 'lines',
                        name: featureName,
                        marker: { color: this.indexToColor(i, Math.max((grids || []).length, 1)) }
                    });
                }
            });
        });
        var layout = {
            title: {
                text: 'Partial Dependence Plot',
                font: {
                    size: 14
                },
                xref: 'paper',
                x: 0.05,
            },
            legend: {
                x: 0.1,
                y: 1,
                orientation: "h",
                font: {
                    size: 8
                },
                bgcolor: 'rgba(0,0,0,0)',
            },

            font: {
                size: 10
            },
            autosize: true,
            xaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                zeroline: false,
                title: {
                    text: 'Feature',
                }
            },
            yaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                zeroline: false,
                title: {
                    text: 'Prediction',
                }
            },
        };
        if (traces.length > 0) {
            window.Plotly.newPlot(chartId, traces, layout, { ...plotlyImageExportConfig, responsive: true });
        }
        var layout2 = {
            title: {
                text: 'Partial Dependence Plot',
                font: {
                    size: 14
                },
                xref: 'paper',
                x: 0.05,
            },

            barmode: 'group',
            font: {
                size: 10
            },
            autosize: true,
            xaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                title: {
                    text: 'Feature',
                }
            },
            bargap: 0.05,
            yaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                title: {
                    text: 'Prediction',
                }
            },
        };

        if (traces_categoricals.length > 0) {
            window.Plotly.newPlot(chartIdCategorical, traces_categoricals, layout2);
        }
    }
    drawAutoencoder(points, xIndex = 0, yIndex = 1, labels, is_classification) {
        if (!points || points.length === 0) return;
        const dims = points[0]?.length ?? 0;
        xIndex = Math.min(Math.max(0, xIndex), dims - 1);
        yIndex = Math.min(Math.max(0, yIndex), dims - 1);
        if (xIndex < 0 || yIndex < 0) return;
        labels = (labels && labels.length === points.length)
            ? labels.map(l => Array.isArray(l) ? l[0] : l)
            : points.map((_, i) => i);
        let colors = [];
        if (is_classification) {
            var uniqueLabels = [...new Set(labels)];
            colors = points.map((_, i) => this.indexToColor(uniqueLabels.indexOf(labels[i]), uniqueLabels.length))
        } else {
            let min = Math.min(...labels);
            let max = Math.max(...labels);
            colors = labels.map(label => this.indexToColorSequential(label, min, max))
        }
        const xVals = points.map(point => point[xIndex]);
        const yVals = points.map(point => point[yIndex]);
        var trace1 = {
            x: xVals,
            y: yVals,
            mode: 'markers',
            type: 'scatter',
            marker: {
                size: 6,
                color: colors,
                line: { width: 0.5, color: 'white' }
            }
        };

        var data = [trace1];

        var layout = {
            legend: {
                y: 0.5,
                yref: 'paper',
                font: {
                    family: 'Arial, sans-serif',
                    size: 20,
                    color: 'grey',
                }
            },
            xaxis: {
                linecolor: 'black',
                linewidth: 1,
                mirror: true,
                zeroline: false,

            },
            yaxis: {
                linecolor: 'black',
                linewidth: 1,
                zeroline: false,
                mirror: true,
            },
            margin: {
                l: 50,
                r: 40,
                b: 50,
                t: 40,
                pad: 20
            },
        };

        const plotEl = document.getElementById('autoencoder');
        if (plotEl) {
            window.Plotly.purge('autoencoder');
            window.Plotly.newPlot('autoencoder', data, layout, { responsive: true, autosize: true });
        }
    }
    plotROC(id, fprs, tprs, labels, auc) {

        let traces = []
        fprs.forEach((fpr, index) => {
            traces.push(
                {
                    x: fpr,
                    y: tprs[index],
                    mode: 'line',
                    name: labels[index],
                    marker: { color: this.indexToColor(index, labels.length) }
                }
            )
        });
        const graphPalette = getGraphPalette(isDarkMode());
        traces.push(
            {
                x: [0, 1],
                y: [0, 1],
                mode: 'line',
                name: 'Chance Line',
                marker: { color: graphPalette.axisLine },
                line: {
                    dash: 'dot',
                    width: 1
                }
            }
        )
        var layout = mergePlotlyLayout({
            title: {
                text: (labels.length > 2 ? ' One-vs-Rest Strategy ROC Curve' : 'ROC Curve') + ' AUC: ' + (+auc).toFixed(2),
                font: {
                    size: 14,
                    color: graphPalette.text,
                },
            },
            margin: {
                b: 40,
            },
            legend: {
                x: 1,
                xanchor: 'right',
                y: 0.1,
                bgcolor: 'rgba(0,0,0,0)',

            },
            showlegend: true,
            xaxis: {
                linewidth: 1,
                range: [-0.1, 1.1],
                mirror: true,
                title: {
                    text: 'False positive rate',
                },
            },
            yaxis: {
                linewidth: 1,
                mirror: true,
                range: [-0.1, 1.1],
                title: {
                    text: 'True positive rate',
                }
            },
        }, isDarkMode());

        window.Plotly.newPlot('roc_plot_' + id, traces, layout, { responsive: true });
    }

    uniformSplist(n) {
        let numbers = []
        for (let i = 0; i < n; i++) {
            numbers.push(i / (n - 1))
        }
        return numbers;
    }
    async parallelCoordinatePlot(features, labels, column_names, is_classification) {
        labels = Array.isArray(labels) ? labels.flat() : [];
        let uniqueLabels = [];
        if (is_classification) {
            const seen = new Set();
            labels.forEach((label) => {
                const key = labelKey(label);
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueLabels.push(label);
                }
            });
            if (uniqueLabels.length === 2) {
                uniqueLabels.sort((a, b) => (labelKey(a) < labelKey(b) ? -1 : 1));
            }
        } else {
            uniqueLabels = [...new Set(labels)];
        }

        let colorscale, colorValues, cmin, cmax;
        if (is_classification) {
            const labelColorMap = new Map(
                uniqueLabels.map((lab, i) => [labelKey(lab), i])
            );
            colorValues = labels.map(lab => labelColorMap.get(labelKey(lab)) ?? 0);
            const n = uniqueLabels.length;
            if (n === 0) {
                const color = this.indexToColor(0, 1);
                colorscale = [[0, color], [1, color]];
            } else {
                colorscale = uniqueLabels.map((_, i) => {
                    const frac = n === 1 ? 0 : i / (n - 1);
                    return [frac, this.indexToColor(i, n)];
                });
                // Plotly requires exactly [0, ..., 1] endpoints
                if (colorscale.length === 1) {
                    const color = this.indexToColor(0, 1);
                    colorscale = [[0, color], [1, color]];
                }
            }
            cmin = 0;
            cmax = Math.max(n - 1, 1);
        } else {
            colorValues = labels.map(Number);
            colorscale = 'Viridis';
        }

        /* ── Dimensions (axes) ───────────────────────────────────────────
           Each axis is normalised to [min, max] by Plotly automatically.
           Add tickformat to avoid scientific notation for small ranges.
        ─────────────────────────────────────────────────────────────────── */
        const dimensions = column_names.map((column_name, i) => {
            const vals = features.map(m => m[i]);
            const numVals = vals.filter(v => v != null && !isNaN(v));
            const minV = numVals.length ? Math.min(...numVals) : 0;
            const maxV = numVals.length ? Math.max(...numVals) : 1;
            return {
                label: column_name,
                values: vals,
                range: [minV, maxV],
                tickformat: (maxV - minV) < 10 ? '.2f' : '.3g',
            };
        });

        const parcoordsFonts = getParcoordsFonts(isDarkMode());
        const data = [{
            type: 'parcoords',
            line: {
                color: colorValues,
                colorscale,
                cmin,
                cmax,
                opacity: 0.35,
                width: 1.5,
                showscale: !is_classification,
                colorbar: is_classification ? undefined : {
                    thickness: 12,
                    len: 0.6,
                    title: { text: 'Target', side: 'right', font: { size: 11, color: parcoordsFonts.labelfont.color } },
                    tickfont: parcoordsFonts.tickfont,
                    outlinewidth: 0,
                },
            },
            dimensions,
            ...parcoordsFonts,
        }];

        /* ── Layout ──────────────────────────────────────────────────────
           No internal title (the card header owns that).
           t:80 is required: Plotly parcoords renders dimension labels as
           SVG text nodes at the very top of the SVG. With t<60 the labels
           are either clipped by the viewport or rendered outside the visible
           area. b:80 gives the range-value labels (min/max) room at bottom.
        ─────────────────────────────────────────────────────────────────── */
        const layout = mergePlotlyLayout({
            autosize: true,
            height: 480,
            margin: { l: 60, r: 60, t: 80, b: 80 },
        }, isDarkMode());

        const Plotly = await getPlotly();

        // Read the container's actual pixel width before drawing so Plotly
        // doesn't lock axis positions to a stale/zero width.
        // NOTE: offsetWidth is 0 when this component renders inside a hidden
        // v-show panel.  In that case we skip setting an explicit width and
        // let Plotly use autosize; the ResizeObserver in the component will
        // fire with the correct width once the panel becomes visible.
        const containerEl = document.getElementById('parallel_coordinate_plot');
        const initialWidth = containerEl ? containerEl.offsetWidth : 0;
        if (initialWidth > 100) layout.width = initialWidth;

        await Plotly.newPlot(
            'parallel_coordinate_plot',
            data,
            layout,
            {
                ...plotlyImageExportConfig,
                responsive: true,
                displaylogo: false,
                modeBarButtonsToRemove: [
                    'resetScale2d', 'select2d', 'resetViews',
                    'sendDataToCloud', 'hoverCompareCartesian',
                    'lasso2d', 'drawopenpath',
                ],
            }
        );

        // Immediately apply the correct width if we got a good reading.
        // If the container was hidden (width ≤ 100) this is a no-op; the
        // component's ResizeObserver will call resizePlot() once visible.
        if (initialWidth > 100) {
            await Plotly.relayout('parallel_coordinate_plot', { width: initialWidth, autosize: true });
        }
    }
}
