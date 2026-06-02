import { describe, it, expect } from 'vitest';
import { dfColumn, resolveDataFrameColumnName } from '../../src/utils/danfo_frame';

function makeFrame(columns, rows) {
    const $dataIncolumnFormat = columns.map((col) => rows.map((row) => row[col]));
    const frame = {
        columns,
        dtypes: columns.map((col) => (typeof rows[0][col] === 'string' ? 'string' : 'float32')),
        $dataIncolumnFormat,
        index: rows.map((_, i) => i),
        get values() {
            return rows.map((row) => columns.map((col) => row[col]));
        },
    };
    columns.forEach((col) => {
        Object.defineProperty(frame, col, {
            get() {
                const idx = columns.indexOf(col);
                return { values: $dataIncolumnFormat[idx], dtype: frame.dtypes[idx], columns: [col] };
            },
        });
    });
    return frame;
}

describe('danfo_frame.js', () => {
    it('resolveDataFrameColumnName matches case-insensitively', () => {
        const frame = { columns: ['sepallength', 'Species'] };
        expect(resolveDataFrameColumnName(frame, 'species')).toBe('Species');
    });

    it('resolveDataFrameColumnName uses $columns when columns getter is empty', () => {
        const frame = { columns: [], $columns: ['Species'] };
        expect(resolveDataFrameColumnName(frame, 'species', ['Species'])).toBe('Species');
    });

    it('dfColumn reads target via bracket getters after column subset (no .column method)', () => {
        const rows = [
            { sepallength: 5.1, Species: 'Setosa' },
            { sepallength: 4.9, Species: 'Setosa' },
        ];
        const frame = makeFrame(['sepallength', 'Species'], rows);
        const series = dfColumn(frame, 'species');
        expect(series.values).toEqual(['Setosa', 'Setosa']);
    });

    it('dfColumn uses $dataIncolumnFormat when bracket access is missing', () => {
        const frame = {
            columns: ['Species'],
            dtypes: ['string'],
            $dataIncolumnFormat: [['Setosa', 'Versicolor']],
        };
        const series = dfColumn(frame, 'Species');
        expect(series.values).toEqual(['Setosa', 'Versicolor']);
    });

    it('dfColumn throws with available column names when missing', () => {
        const frame = makeFrame(['a', 'b'], [{ a: 1, b: 2 }]);
        expect(() => dfColumn(frame, 'Species')).toThrow(/Available columns: a, b/);
    });
});
