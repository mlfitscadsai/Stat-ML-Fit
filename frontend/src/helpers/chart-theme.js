const GRAPH_LIGHT = {
    paperBg: 'rgba(0,0,0,0)',
    plotBg: '#ffffff',
    panelBg: '#f8fafc',
    text: '#0f172a',
    textMuted: '#334155',
    axisLine: '#475569',
    grid: '#64748b',
    zeroLine: '#475569',
    edgeLabelBg: '#ffffff',
    edgeLabelText: '#0f172a',
    tooltipBg: 'rgba(255,255,255,0.96)',
    tooltipText: '#0f172a',
    annotationBg: 'rgba(255,255,255,0.92)',
    annotationBorder: '#cbd5e1',
};

/** Plot canvases always use a light background for consistent data-ink readability. */
export function getGraphPalette(_isDark = false) {
    return { ...GRAPH_LIGHT };
}

function parseColor(color) {
    if (!color) return null;
    const value = String(color).trim();
    if (value.startsWith('#')) {
        const hex = value.slice(1);
        if (hex.length === 3) {
            return hex.split('').map((part) => Number.parseInt(part + part, 16));
        }
        if (hex.length === 6) {
            return [0, 2, 4].map((idx) => Number.parseInt(hex.slice(idx, idx + 2), 16));
        }
    }
    const match = value.match(/rgba?\(([^)]+)\)/i);
    if (match) {
        return match[1].split(',').slice(0, 3).map((part) => Number.parseFloat(part.trim()));
    }
    return null;
}

function relativeLuminance(color) {
    const rgb = parseColor(color);
    if (!rgb) return 0;
    const [r, g, b] = rgb.map((channel) => {
        const normalized = Math.max(0, Math.min(255, channel)) / 255;
        return normalized <= 0.03928
            ? normalized / 12.92
            : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground, background) {
    const fg = relativeLuminance(foreground);
    const bg = relativeLuminance(background);
    const light = Math.max(fg, bg);
    const dark = Math.min(fg, bg);
    return (light + 0.05) / (dark + 0.05);
}

export function assertGraphPaletteContrast(isDark = false) {
    const palette = getGraphPalette(isDark);
    const checks = [
        ['text', palette.text, palette.plotBg, 4.5],
        ['textMuted', palette.textMuted, palette.plotBg, 4.5],
        ['axisLine', palette.axisLine, palette.plotBg, 3],
        ['grid', palette.grid, palette.plotBg, 3],
        ['edgeLabel', palette.edgeLabelText, palette.edgeLabelBg, 4.5],
        ['tooltip', palette.tooltipText, palette.tooltipBg, 4.5],
    ].map(([name, foreground, background, minimum]) => ({
        name,
        foreground,
        background,
        minimum,
        ratio: contrastRatio(foreground, background),
    }));
    return {
        passes: checks.every((check) => check.ratio >= check.minimum),
        checks,
    };
}

export function getPlotlyAxisDefaults(isDark = false) {
    const palette = getGraphPalette(isDark);
    return {
        showgrid: true,
        gridcolor: palette.grid,
        zerolinecolor: palette.zeroLine,
        linecolor: palette.axisLine,
        mirror: true,
        tickfont: { color: palette.textMuted },
        titlefont: { color: palette.text },
    };
}

export function getParcoordsFonts(isDark = false) {
    const palette = getGraphPalette(isDark);
    const family = 'Inter, system-ui, sans-serif';
    return {
        labelfont: { size: 13, color: palette.text, family },
        tickfont: { size: 11, color: palette.textMuted, family },
        rangefont: { size: 10, color: palette.textMuted, family },
    };
}

export function getPlotlyLayoutBase(isDark = false) {
    const palette = getGraphPalette(isDark);
    const axis = getPlotlyAxisDefaults(isDark);
    return {
        paper_bgcolor: palette.paperBg,
        plot_bgcolor: palette.plotBg,
        font: {
            family: 'Inter, system-ui, sans-serif',
            size: 11,
            color: palette.text,
        },
        xaxis: {
            ...axis,
        },
        yaxis: {
            ...axis,
        },
        legend: {
            font: { color: palette.text },
            bgcolor: palette.paperBg,
            bordercolor: palette.axisLine,
        },
    };
}

export function getHighchartsTheme(_isDark = false) {
    const palette = getGraphPalette(false);
    return {
        chart: {
            backgroundColor: palette.plotBg,
            style: { color: palette.text },
        },
        title: { style: { color: palette.text } },
        xAxis: {
            gridLineColor: palette.grid,
            labels: { style: { color: palette.textMuted } },
            title: { style: { color: palette.text } },
        },
        yAxis: {
            gridLineColor: palette.grid,
            labels: { style: { color: palette.textMuted } },
            title: { style: { color: palette.text } },
        },
        legend: {
            itemStyle: { color: palette.text },
        },
    };
}

export function mergePlotlyLayout(baseLayout = {}, isDark = false) {
    return {
        ...getPlotlyLayoutBase(isDark),
        ...baseLayout,
        xaxis: { ...getPlotlyLayoutBase(isDark).xaxis, ...(baseLayout.xaxis || {}) },
        yaxis: { ...getPlotlyLayoutBase(isDark).yaxis, ...(baseLayout.yaxis || {}) },
        font: { ...getPlotlyLayoutBase(isDark).font, ...(baseLayout.font || {}) },
    };
}
