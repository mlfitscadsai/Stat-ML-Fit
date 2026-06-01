import { describe, expect, it } from 'vitest';
import {
    buildScatterplotMatrixTracesAndLayout,
    computeColumnRange,
    tickFormatForRange,
} from '../../src/helpers/scatterplot_matrix_impl.js';
import { contrastRatio } from '../../src/helpers/chart-theme.js';

const controller = {
    indexToColor(index) {
        return ['#3b82f6', '#10b981', '#f59e0b'][index % 3];
    },
    indexToColorSequential() {
        return '#3b82f6';
    },
    nrd() {
        return 1;
    },
};

describe('scatterplot matrix theme layout', () => {
    it('uses a contrast-safe light canvas layout even in dark mode', () => {
        const { layout, traces } = buildScatterplotMatrixTracesAndLayout(
            controller,
            [
                [1, 2],
                [2, 3],
                [3, 5],
                [4, 8],
            ],
            ['A', 'B'],
            ['setosa', 'setosa', 'virginica', 'virginica'],
            true,
            'Species',
            false,
            true,
        );

        expect(layout.plot_bgcolor).toBe('#ffffff');
        expect(layout.font.color).toBe('#0f172a');
        expect(layout.xaxis1.gridcolor).toBe('#64748b');
        expect(contrastRatio(layout.font.color, layout.plot_bgcolor)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(layout.xaxis1.gridcolor, layout.plot_bgcolor)).toBeGreaterThanOrEqual(3);

        const textTrace = traces.find((trace) => trace.mode === 'text');
        expect(textTrace.textfont.color).toBe('#0f172a');
    });

    it('applies per-column ranges and edge tick labels for large matrices', () => {
        const items = Array.from({ length: 40 }, (_, r) =>
            Array.from({ length: 4 }, (_, c) => r * 0.5 + c * 10 + 1)
        );
        const { layout } = buildScatterplotMatrixTracesAndLayout(
            controller,
            items,
            ['f0', 'f1', 'f2', 'f3'],
            null,
            false,
            'Class',
            false,
            false,
        );

        expect(layout.margin.l).toBeGreaterThanOrEqual(44);
        expect(layout.margin.b).toBeGreaterThanOrEqual(52);

        const col0Range = computeColumnRange(items, 0);
        const bottomLeftScatterKey = 'xaxis13';
        const leftColScatterYKey = 'yaxis13';
        expect(layout[bottomLeftScatterKey].range).toEqual(col0Range);
        expect(layout[bottomLeftScatterKey].showticklabels).toBe(true);
        expect(layout[leftColScatterYKey].showticklabels).toBe(true);

        const corrKey = 'xaxis2';
        expect(layout[corrKey].range).toEqual([0, 1]);
        expect(layout[corrKey].showticklabels).toBe(false);
    });

    it('formats ticks for standardized and squared transforms', () => {
        const standardized = Array.from({ length: 20 }, (_, i) => (i - 10) / 3);
        const squared = Array.from({ length: 20 }, (_, i) => i * i);
        expect(tickFormatForRange(computeColumnRange(standardized.map((v) => [v]), 0))).toBe('.2f');
        expect(tickFormatForRange(computeColumnRange(squared.map((v) => [v]), 0))).toBe('.0f');
    });
});
