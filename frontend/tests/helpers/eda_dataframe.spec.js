import { describe, expect, it, vi } from 'vitest';

vi.mock('@/helpers/utils', () => ({
    transformColumnValues: (values, scaler) => {
        if (scaler === 1) return values.map((v) => v / 10);
        return values;
    },
    applyDataTransformation: vi.fn(async () => {}),
}));

import {
    buildEdaBaseValues,
    buildEdaDisplayValues,
    getEdaCacheKey,
} from '@/helpers/eda_dataframe';

function makeMockDanfo(rows) {
    const columns = rows.length ? Object.keys(rows[0]) : [];

    class MockFrame {
        constructor(data) {
            const source = Array.isArray(data) ? initial : (data || initial);
            this.$data = rows;
            this.columns = Object.keys(source);
            this._values = { ...source };
            for (const col of this.columns) {
                this[col] = { values: this._values[col] };
            }
        }
        column(name) {
            return { values: this._values[name] };
        }
        addColumn(name, values, { inplace } = {}) {
            this._values[name] = values;
            this[name] = { values };
            if (!this.columns.includes(name)) {
                this.columns.push(name);
            }
            return inplace ? this : new MockFrame(this._values);
        }
        async sample(_n, { seed } = {}) {
            void seed;
            return new MockFrame(this._values);
        }
        dropNa() {
            return this;
        }
    }

    const initial = {};
    for (const col of columns) {
        initial[col] = rows.map((row) => row[col]);
    }

    return {
        DataFrame: MockFrame,
    };
}

describe('eda_dataframe', () => {
    it('builds a stable cache key from merge and row-filter state', () => {
        const keyA = getEdaCacheKey({
            rawRowCount: 100,
            seed: 42,
            classTransformations: [[{ class: '3' }, { class: '4' }]],
            edaRowKeepIndices: [0, 2, 4],
            modelTarget: 'quality',
        });
        const keyB = getEdaCacheKey({
            rawRowCount: 100,
            seed: 42,
            classTransformations: [[{ class: '3' }, { class: '4' }]],
            edaRowKeepIndices: [0, 2, 4],
            modelTarget: 'quality',
        });
        expect(keyA).toBe(keyB);
        expect(keyA).not.toBe(getEdaCacheKey({ rawRowCount: 99, seed: 42 }));
    });

    it('applies class merges and row filters for wine-like numeric targets', async () => {
        const rows = [
            { a: 1, quality: 3 },
            { a: 2, quality: 4 },
            { a: 3, quality: 5 },
            { a: 4, quality: 6 },
        ];
        const danfo = makeMockDanfo(rows);
        const { values } = await buildEdaBaseValues({
            rawData: rows,
            modelTarget: 'quality',
            isClassification: true,
            mergedClasses: [[{ class: '3' }, { class: '4' }]],
            seed: 1,
            edaRowKeepIndices: [0, 1, 2],
            danfo,
        });
        expect(values.quality).toEqual(['3_4', '3_4', 5]);
        expect(values.a).toEqual([1, 2, 3]);
    });

    it('supports iris-like string class labels', async () => {
        const rows = [
            { sepal: 5.1, species: 'setosa' },
            { sepal: 4.9, species: 'versicolor' },
            { sepal: 4.7, species: 'virginica' },
        ];
        const danfo = makeMockDanfo(rows);
        const { values } = await buildEdaBaseValues({
            rawData: rows,
            modelTarget: 'species',
            isClassification: true,
            mergedClasses: [[{ class: 'versicolor' }, { class: 'virginica' }]],
            seed: 1,
            edaRowKeepIndices: null,
            danfo,
        });
        expect(values.species).toEqual(['setosa', 'versicolor_virginica', 'versicolor_virginica']);
    });

    it('applies feature scalers on display values', () => {
        const base = {
            columns: ['a', 'quality'],
            values: { a: [0, 10], quality: [3, 4] },
        };
        const settings = {
            items: [
                { name: 'a', selected: true, type: 1, scaler: 1 },
                { name: 'quality', selected: true, type: 1, scaler: 0 },
            ],
        };
        const display = buildEdaDisplayValues(base, settings);
        expect(display.a).toEqual([0, 1]);
        expect(display.quality).toEqual([3, 4]);
    });
});
