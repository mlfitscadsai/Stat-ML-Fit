import { describe, expect, it } from 'vitest';
import {
    assertGraphPaletteContrast,
    contrastRatio,
    getGraphPalette,
    getHighchartsTheme,
    getParcoordsFonts,
    getPlotlyAxisDefaults,
    getPlotlyLayoutBase,
    mergePlotlyLayout,
} from '../../src/helpers/chart-theme.js';

describe('chart theme helper', () => {
    it('returns light plot backgrounds by default', () => {
        const layout = getPlotlyLayoutBase(false);
        expect(layout.plot_bgcolor).toBe('#ffffff');
        expect(layout.font.color).toBe('#0f172a');
    });

    it('keeps light plot backgrounds in dark mode', () => {
        const layout = getPlotlyLayoutBase(true);
        expect(layout.plot_bgcolor).toBe('#ffffff');
        expect(layout.xaxis.gridcolor).toBe('#64748b');
        expect(layout.xaxis.tickfont.color).toBe('#334155');
    });

    it('merges custom layout with themed defaults', () => {
        const merged = mergePlotlyLayout({ title: 'Demo' }, true);
        expect(merged.title).toBe('Demo');
        expect(merged.plot_bgcolor).toBe('#ffffff');
    });

    it('returns highcharts theme colors on a light canvas', () => {
        const theme = getHighchartsTheme(true);
        expect(theme.chart.backgroundColor).toBe('#ffffff');
        expect(theme.legend.itemStyle.color).toBe('#0f172a');
    });

    it('provides WCAG AA contrast-safe graph palettes', () => {
        expect(assertGraphPaletteContrast(false).passes).toBe(true);
        expect(assertGraphPaletteContrast(true).passes).toBe(true);

        const palette = getGraphPalette(true);

        expect(contrastRatio(palette.text, palette.plotBg)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.textMuted, palette.plotBg)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.edgeLabelText, palette.edgeLabelBg)).toBeGreaterThanOrEqual(4.5);
    });

    it('uses light-canvas axis and parcoords text colors in dark mode', () => {
        const darkAxis = getPlotlyAxisDefaults(true);
        const darkFonts = getParcoordsFonts(true);

        expect(darkAxis.gridcolor).toBe('#64748b');
        expect(darkAxis.tickfont.color).toBe('#334155');
        expect(darkFonts.labelfont.color).toBe('#0f172a');
        expect(darkFonts.tickfont.color).toBe('#334155');
    });
});
