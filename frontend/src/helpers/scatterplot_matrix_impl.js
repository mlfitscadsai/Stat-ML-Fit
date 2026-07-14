import { equalIntervalBreaks, kernelDensityEstimation, standardDeviation } from 'simple-statistics';
import { corrcoeff } from 'jstat';
import { labelKey } from '@/helpers/splom_data';
import { getGraphPalette, getPlotlyAxisDefaults, mergePlotlyLayout } from '@/helpers/chart-theme';

/** Ordinal / categorical numerics (e.g. Titanic Pclass 1–3): use bar counts on diagonal, not KDE. */
const DISCRETE_MAX_UNIQUES = 16;

/** @returns {[number, number] | null} padded [min, max] for a numeric column */
export function computeColumnRange(items, colIndex, { padRatio = 0.06 } = {}) {
    const vals = [];
    for (const row of items) {
        const v = Number(row[colIndex]);
        if (Number.isFinite(v)) vals.push(v);
    }
    if (!vals.length) return null;
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (min === max) {
        const pad = Math.max(Math.abs(min), 1) * 0.12;
        min -= pad;
        max += pad;
    } else {
        const pad = (max - min) * padRatio;
        min -= pad;
        max += pad;
    }
    return [min, max];
}

/** Pick a compact tick format from the data span (works for Scale / Standardize / ln / x²). */
export function tickFormatForRange(range) {
    if (!range || range.length < 2) return '.2f';
    const span = Math.max(Math.abs(range[1] - range[0]), Math.abs(range[1]), Math.abs(range[0]));
    if (span >= 1e4) return '.2e';
    if (span >= 100) return '.0f';
    if (span >= 10) return '.1f';
    if (span >= 1) return '.2f';
    if (span >= 0.05) return '.3f';
    return '.2e';
}

function tickCountForMatrix(n) {
    if (n > 10) return 3;
    if (n > 7) return 4;
    return 5;
}

function cellSizeForMatrix(n) {
    if (n > 10) return Math.max(96, Math.min(112, Math.floor(1040 / n)));
    if (n > 7) return Math.max(92, Math.min(120, Math.floor(980 / n)));
    return Math.max(88, Math.min(132, Math.floor(920 / n)));
}

function cellValueKey(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    if (Number.isFinite(n)) return String(n);
    const s = String(v).trim();
    return s.length ? s : null;
}

/** @returns {{ discrete: boolean, categories: string[] }} */
function getDiscreteCategories(items, varIndex) {
    const keys = new Set();
    for (const row of items) {
        const k = cellValueKey(row[varIndex]);
        if (k != null) keys.add(k);
    }
    if (keys.size === 0 || keys.size > DISCRETE_MAX_UNIQUES) {
        return { discrete: false, categories: [] };
    }
    const categories = [...keys].sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return String(a).localeCompare(String(b));
    });
    return { discrete: true, categories };
}

/**
 * Scatterplot matrix (SPLOM) — extended grid with optional class row/column:
 * - Diagonal: KDE per class (numeric) or bar chart (class distribution)
 * - Upper triangle: Pearson r (numeric–numeric); class column: boxplots by class
 * - Lower triangle: scatter (numeric–numeric); class row: strip-style scatter vs class
 *
 * `items` must be numeric rows only (no label column). `labels` is parallel to rows.
 * @param extendTargetMargins — extra row/column for target (classification only; caller decides).
 */
export function buildScatterplotMatrixTracesAndLayout(
    controller,
    items,
    features,
    labels,
    is_classification,
    targetColumnName = 'Class',
    extendTargetMargins = false,
    isDark = false
) {
    const graphPalette = getGraphPalette(isDark);
    const axisDefaults = getPlotlyAxisDefaults(isDark);
    const nNum = features.length;
    const nR = items.length;
    if (nNum < 2) {
        return { traces: [], layout: null, error: 'Need at least 2 numeric columns.' };
    }

    const useClassColor = Boolean(
        is_classification && labels && Array.isArray(labels) && labels.length === nR
    );

    const uniqueLabels = [];
    if (useClassColor) {
        const seen = new Set();
        for (const l of labels) {
            const k = labelKey(l);
            if (!seen.has(k)) {
                seen.add(k);
                uniqueLabels.push(l);
            }
        }
        if (uniqueLabels.length === 2) {
            uniqueLabels.sort((a, b) => (labelKey(a) < labelKey(b) ? -1 : 1));
        }
    }

    const useExtendedGrid = Boolean(useClassColor && extendTargetMargins && uniqueLabels.length > 0);

    const className = targetColumnName || 'Class';
    const n = useExtendedGrid ? nNum + 1 : nNum;
    const axisNames = useExtendedGrid ? [...features, className] : [...features];

    const labelIndex = (l) => {
        const k = labelKey(l);
        const i = uniqueLabels.findIndex((u) => labelKey(u) === k);
        return i >= 0 ? i : 0;
    };

    const rowColors = useClassColor
        ? labels.map((l) =>
              controller.indexToColor(labelIndex(l), Math.max(uniqueLabels.length, 1))
          )
        : labels && labels.length === nR
          ? (() => {
                const nums = labels.map(Number).filter((x) => Number.isFinite(x));
                if (!nums.length) return Array(nR).fill('rgba(80, 120, 200, 0.65)');
                const mn = Math.min(...nums);
                const mx = Math.max(...nums);
                return labels.map((v) =>
                    controller.indexToColorSequential(Number(v), mn, mx)
                );
            })()
          : Array(nR).fill('rgba(80, 120, 200, 0.65)');

    const traces = [];
    // Many WebGL scattergl subplots are slow to init; SVG scatter is fine for typical EDA sizes.
    const scatterTraceType = nR > 2500 ? 'scattergl' : 'scatter';

    const pushKdeDiagonal = (varIndex, xaxis, yaxis) => {
        if (!useClassColor) {
            try {
                const vals = items.map((row) => Number(row[varIndex])).filter(Number.isFinite);
                if (vals.length < 3) return;
                const bw = Number(controller.nrd(vals).toFixed(4));
                const breaks = equalIntervalBreaks(vals, Math.min(100, vals.length));
                const kde = kernelDensityEstimation(vals, 'gaussian', 'nrd');
                const data = breaks.map((x) => [x, kde(x, bw)]);
                traces.push({
                    type: 'scatter',
                    x: data.map((d) => d[0]),
                    y: data.map((d) => d[1]),
                    xaxis,
                    yaxis,
                    mode: 'lines',
                    fill: 'tozeroy',
                    line: { color: 'rgb(219, 64, 82)', width: 2 },
                    showlegend: false,
                });
            } catch {
                /* skip cell on numeric issues */
            }
            return;
        }
        for (let k = 0; k < uniqueLabels.length; k++) {
            try {
                const uk = uniqueLabels[k];
                const vals = items
                    .map((row, r) => (labelKey(labels[r]) === labelKey(uk) ? Number(row[varIndex]) : null))
                    .filter((v) => v != null && Number.isFinite(v));
                if (vals.length < 2) continue;
                const bw = Number(controller.nrd(vals).toFixed(4));
                const breaks = equalIntervalBreaks(vals, Math.min(100, vals.length));
                const kde = kernelDensityEstimation(vals, 'gaussian', 'nrd');
                const data = breaks.map((x) => [x, kde(x, bw)]);
                traces.push({
                    type: 'scatter',
                    x: data.map((d) => d[0]),
                    y: data.map((d) => d[1]),
                    xaxis,
                    yaxis,
                    mode: 'lines',
                    fill: 'tozeroy',
                    line: { color: controller.indexToColor(k, uniqueLabels.length), width: 2 },
                    showlegend: false,
                });
            } catch {
                /* skip series */
            }
        }
    };

    const pushDiscreteDiagonal = (varIndex, xaxis, yaxis, categories) => {
        if (!categories.length) return;
        if (!useClassColor) {
            const counts = categories.map(
                (cat) => items.filter((row) => cellValueKey(row[varIndex]) === cat).length
            );
            traces.push({
                type: 'bar',
                x: categories,
                y: counts,
                xaxis,
                yaxis,
                marker: { color: 'rgb(219, 64, 82)', opacity: 0.88 },
                showlegend: false,
            });
            return;
        }
        for (let k = 0; k < uniqueLabels.length; k++) {
            const uk = uniqueLabels[k];
            const counts = categories.map(
                (cat) =>
                    items.filter(
                        (row, r) =>
                            labelKey(labels[r]) === labelKey(uk) &&
                            cellValueKey(row[varIndex]) === cat
                    ).length
            );
            traces.push({
                type: 'bar',
                x: categories,
                y: counts,
                xaxis,
                yaxis,
                marker: { color: controller.indexToColor(k, uniqueLabels.length), opacity: 0.88 },
                offsetgroup: String(k),
                alignmentgroup: `diag_${varIndex}`,
                showlegend: false,
            });
        }
    };

    const pushBarSpecies = (xaxis, yaxis) => {
        const counts = uniqueLabels.map((lab) => labels.filter((l) => labelKey(l) === labelKey(lab)).length);
        traces.push({
            type: 'bar',
            x: uniqueLabels.map(String),
            y: counts,
            xaxis,
            yaxis,
            marker: {
                color: uniqueLabels.map((_, z) => controller.indexToColor(z, uniqueLabels.length)),
                opacity: 0.88,
            },
            showlegend: false,
        });
    };

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const idx = i * n + j + 1;
            const xaxis = `x${idx}`;
            const yaxis = `y${idx}`;

            if (i === j) {
                if (i < nNum) {
                    const { discrete, categories } = getDiscreteCategories(items, i);
                    if (discrete) {
                        pushDiscreteDiagonal(i, xaxis, yaxis, categories);
                    } else {
                        const traceCountBefore = traces.length;
                        pushKdeDiagonal(i, xaxis, yaxis);
                        if (traces.length === traceCountBefore) {
                            const keys = new Set();
                            for (const row of items) {
                                const k = cellValueKey(row[i]);
                                if (k != null) keys.add(k);
                            }
                            if (keys.size > 0 && keys.size <= 24) {
                                const cats = [...keys].sort((a, b) => {
                                    const na = Number(a);
                                    const nb = Number(b);
                                    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
                                    return String(a).localeCompare(String(b));
                                });
                                pushDiscreteDiagonal(i, xaxis, yaxis, cats);
                            }
                        }
                    }
                } else if (useExtendedGrid) {
                    pushBarSpecies(xaxis, yaxis);
                }
                continue;
            }

            if (i < j) {
                if (useExtendedGrid && j === n - 1 && i < nNum) {
                    for (let k = 0; k < uniqueLabels.length; k++) {
                        const uk = uniqueLabels[k];
                        const yv = items
                            .filter((_, r) => labelKey(labels[r]) === labelKey(uk))
                            .map((row) => Number(row[i]))
                            .filter(Number.isFinite);
                        if (!yv.length) continue;
                        traces.push({
                            type: 'box',
                            x: yv.map(() => String(uniqueLabels[k])),
                            y: yv,
                            xaxis,
                            yaxis,
                            marker: { color: controller.indexToColor(k, uniqueLabels.length), size: 3 },
                            line: { width: 1 },
                            boxpoints: 'suspectedoutliers',
                            fillcolor: isDark ? 'rgba(219,234,254,0.18)' : 'rgba(15,23,42,0.08)',
                            showlegend: false,
                        });
                    }
                } else if (i < nNum && j < nNum) {
                    const a = items.map((row) => Number(row[i]));
                    const b = items.map((row) => Number(row[j]));
                    let txt = '—';
                    if (a.length === b.length && a.every(Number.isFinite) && b.every(Number.isFinite)) {
                        const sdX = standardDeviation(b);
                        const sdY = standardDeviation(a);
                        if (sdX > 0 && sdY > 0) {
                            txt = corrcoeff(b, a).toFixed(2);
                        }
                    }
                    traces.push({
                        type: 'scatter',
                        x: [0.5],
                        y: [0.5],
                        xaxis,
                        yaxis,
                        mode: 'text',
                        text: [txt],
                        textfont: { size: 13, color: graphPalette.text },
                        showlegend: false,
                    });
                } else {
                    traces.push({
                        type: 'scatter',
                        x: [0.5],
                        y: [0.5],
                        xaxis,
                        yaxis,
                        mode: 'text',
                        text: [''],
                        showlegend: false,
                    });
                }
                continue;
            }

            if (useExtendedGrid && i === n - 1 && j < nNum) {
                const jitter = labels.map((_, r) => (((r * 17) % 11) / 40 - 0.14));
                traces.push({
                    type: 'scatter',
                    x: items.map((row) => Number(row[j])),
                    y: labels.map((lab, r) => labelIndex(lab) + jitter[r]),
                    xaxis,
                    yaxis,
                    mode: 'markers',
                    marker: { color: rowColors, size: 6, opacity: 0.78 },
                    showlegend: false,
                });
            } else if (i < nNum && j < nNum) {
                traces.push({
                    type: scatterTraceType,
                    x: items.map((row) => Number(row[j])),
                    y: items.map((row) => Number(row[i])),
                    xaxis,
                    yaxis,
                    mode: 'markers',
                    marker: { color: rowColors, size: 5, opacity: 0.78 },
                    showlegend: false,
                });
            } else {
                traces.push({
                    type: 'scatter',
                    x: [0.5],
                    y: [0.5],
                    xaxis,
                    yaxis,
                    mode: 'text',
                    text: [''],
                    showlegend: false,
                });
            }
        }
    }

    const discreteFlags = Array.from({ length: nNum }, (_, idx) => getDiscreteCategories(items, idx).discrete);
    const colRanges = Array.from({ length: nNum }, (_, idx) =>
        discreteFlags[idx] ? null : computeColumnRange(items, idx)
    );
    const nticks = tickCountForMatrix(n);
    const cellPx = cellSizeForMatrix(n);
    const longestNameLen = Math.max(...axisNames.map((name) => String(name).length), 6);
    const marginL = Math.min(148, 48 + longestNameLen * 5);
    const marginB = Math.min(148, 56 + longestNameLen * 4);
    const marginR = 12;
    const marginT = 28;
    const plotWidth = cellPx * n + marginL + marginR;
    const plotHeight = cellPx * n + marginT + marginB;
    const axisTitleFont = { size: n > 9 ? 9 : 10, color: graphPalette.text };
    const tickFont = { size: n > 9 ? 9 : 10, color: graphPalette.text };

    const layout = mergePlotlyLayout({
        width: plotWidth,
        height: plotHeight,
        showlegend: false,
        barmode: 'group',
        grid: {
            rows: n,
            columns: n,
            pattern: 'independent',
            xgap: 0.04,
            ygap: 0.04,
        },
        margin: { t: marginT, r: marginR, b: marginB, l: marginL },
        paper_bgcolor: graphPalette.panelBg,
        plot_bgcolor: graphPalette.plotBg,
        font: { family: 'Manrope, Segoe UI, sans-serif', size: 11, color: graphPalette.text },
    }, isDark);

    const applyNumericXRange = (xKey, colIdx) => {
        const xr = colRanges[colIdx];
        if (!xr) return;
        layout[xKey].range = xr.slice();
        layout[xKey].tickformat = tickFormatForRange(xr);
        layout[xKey].nticks = nticks;
    };

    const applyNumericYRange = (yKey, rowIdx) => {
        const yr = colRanges[rowIdx];
        if (!yr) return;
        layout[yKey].range = yr.slice();
        layout[yKey].tickformat = tickFormatForRange(yr);
        layout[yKey].nticks = nticks;
    };

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const k = i * n + j + 1;
            const xKey = `xaxis${k}`;
            const yKey = `yaxis${k}`;
            const isDiagonal = i === j;
            const isUpperText = i < j && i < nNum && j < nNum;
            const isCorrSquare = isUpperText;
            const isLowerScatter = i > j && i < nNum && j < nNum;
            const isSpeciesStrip = useExtendedGrid && i === n - 1 && j < nNum;
            const isSpeciesBoxCol = useExtendedGrid && j === n - 1 && i < nNum;

            layout[xKey] = {
                ...axisDefaults,
                showgrid: !isCorrSquare,
                zeroline: false,
                mirror: true,
                showticklabels: false,
                fixedrange: true,
                tickfont: tickFont,
            };
            layout[yKey] = {
                ...axisDefaults,
                showgrid: !isCorrSquare,
                zeroline: false,
                mirror: true,
                showticklabels: false,
                fixedrange: true,
                tickfont: tickFont,
            };

            if (isCorrSquare) {
                layout[xKey].range = [0, 1];
                layout[yKey].range = [0, 1];
                layout[xKey].showgrid = false;
                layout[yKey].showgrid = false;
            } else if (isLowerScatter) {
                applyNumericXRange(xKey, j);
                applyNumericYRange(yKey, i);
            } else if (isDiagonal && i < nNum && !discreteFlags[i]) {
                applyNumericXRange(xKey, i);
            } else if (isSpeciesStrip) {
                applyNumericXRange(xKey, j);
                const nClasses = Math.max(uniqueLabels.length, 1);
                layout[yKey].range = [-0.35, nClasses - 0.65];
                layout[yKey].nticks = Math.min(nticks, nClasses);
            } else if (isSpeciesBoxCol) {
                applyNumericYRange(yKey, i);
            }

            if (isSpeciesBoxCol) {
                layout[xKey].showticklabels = true;
                layout[xKey].tickangle = -35;
            }

            if (isSpeciesStrip && j === 0) {
                layout[yKey].showticklabels = true;
                layout[yKey].tickmode = 'array';
                layout[yKey].tickvals = uniqueLabels.map((_, vi) => vi);
                layout[yKey].ticktext = uniqueLabels.map(String);
                layout[yKey].title = {
                    text: className,
                    font: axisTitleFont,
                    standoff: 6,
                };
            }

            const showLeftYTicks =
                j === 0 &&
                !isCorrSquare &&
                (isLowerScatter || (isDiagonal && i < nNum)) &&
                !isSpeciesStrip;

            if (showLeftYTicks) {
                layout[yKey].showticklabels = true;
                layout[yKey].automargin = true;
                layout[yKey].title = {
                    text: axisNames[i],
                    font: axisTitleFont,
                    standoff: 6,
                };
            }

            const showBottomXTicks =
                i === n - 1 &&
                !isCorrSquare &&
                (isLowerScatter || (isDiagonal && j < nNum) || isSpeciesStrip || isSpeciesBoxCol);

            if (showBottomXTicks) {
                layout[xKey].showticklabels = true;
                layout[xKey].tickangle = n > 8 ? -42 : -35;
                layout[xKey].automargin = true;
                layout[xKey].title = {
                    text: axisNames[j],
                    font: axisTitleFont,
                    standoff: 8,
                };
            }
        }
    }

    return { traces, layout, error: null, plotWidth, plotHeight };
}
