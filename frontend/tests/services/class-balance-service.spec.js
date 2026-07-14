import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
    applyClassBalanceToRows,
    applyClassBalanceToSplit,
    applyClassBalanceToValues,
    countClasses,
    detectOrdinalLabels,
    distributionFromCounts,
    formatClassBalanceReport,
    needsClassBalance,
    normalizeClassLabel,
    planClassBalance,
    planToClassTransformations,
    summarizeBalanceImpact,
    validateClassBalance,
    DEFAULT_CLASS_BALANCE_OPTIONS,
} from '../../src/services/preprocessing/class-balance-service.js';

function loadWineQualities() {
    const csvPath = path.resolve(process.cwd(), 'public/wine.csv');
    const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
    return lines.slice(1).map((line) => line.split(',').slice(-2, -1)[0]);
}

describe('class-balance-service', () => {
    it('normalizes numeric and string labels consistently', () => {
        expect(normalizeClassLabel(5)).toBe('5');
        expect(normalizeClassLabel('5')).toBe('5');
        expect(normalizeClassLabel(' 5 ')).toBe('5');
        expect(normalizeClassLabel('low')).toBe('low');
        expect(normalizeClassLabel(null)).toBeNull();
    });

    it('counts classes with mixed numeric types as one label', () => {
        const counts = countClasses([5, '5', 5, '6', 6]);
        expect(counts.get('5')).toBe(3);
        expect(counts.get('6')).toBe(2);
    });

    it('detects ordinal wine quality labels', () => {
        expect(detectOrdinalLabels(['3', '4', '5', '6'])).toBe(true);
        expect(detectOrdinalLabels(['low', 'medium', 'high'])).toBe(false);
        expect(detectOrdinalLabels(['1', '2', 'high'])).toBe(false);
    });

    it('identifies underrepresented wine quality classes', () => {
        const qualities = loadWineQualities();
        const plan = planClassBalance(qualities, { strategy: 'auto' });

        expect(plan.original.distribution.length).toBe(6);
        expect(plan.original.distribution.find((entry) => entry.label === '3').share).toBeLessThan(0.05);
        expect(plan.original.distribution.find((entry) => entry.label === '4').share).toBeLessThan(0.05);
        expect(plan.original.distribution.find((entry) => entry.label === '8').share).toBeLessThan(0.05);
    });

    it('balances wine classes to meet minimum share without excessive removal', () => {
        const qualities = loadWineQualities();
        const plan = planClassBalance(qualities, { strategy: 'auto' });
        const validation = validateClassBalance(plan);

        expect(plan.removedFraction).toBeLessThan(DEFAULT_CLASS_BALANCE_OPTIONS.maxRemovalFraction);
        expect(plan.final.distribution.length).toBeGreaterThanOrEqual(2);
        expect(plan.final.distribution.every((entry) => entry.share >= DEFAULT_CLASS_BALANCE_OPTIONS.underrepresentedThreshold)).toBe(true);
        expect(validation.ok).toBe(true);
        expect(plan.passedValidation).toBe(true);
    });

    it('skips already-balanced multiclass datasets (iris-like)', () => {
        const values = [
            ...Array(50).fill('setosa'),
            ...Array(50).fill('versicolor'),
            ...Array(50).fill('virginica'),
        ];
        expect(needsClassBalance(values)).toBe(false);

        const plan = planClassBalance(values, { strategy: 'auto' });
        expect(plan.skipped).toBe(false);
        expect(plan.mergeGroups).toHaveLength(0);
        expect(plan.final.distribution.length).toBe(3);
        expect(validateClassBalance(plan).ok).toBe(true);
    });

    it('skips binary collapse-risk datasets without breaking training', () => {
        const values = [...Array(96).fill('0'), ...Array(4).fill('1')];
        expect(needsClassBalance(values)).toBe(false);

        const plan = planClassBalance(values, { strategy: 'auto' });
        expect(plan.skipped).toBe(true);
        expect(plan.skipReason).toBe('binary_collapse_risk');
        expect(plan.final.distribution.length).toBe(2);
        expect(validateClassBalance(plan).ok).toBe(true);
    });

    it('handles balanced binary datasets without changes', () => {
        const values = [...Array(50).fill('yes'), ...Array(50).fill('no')];
        expect(needsClassBalance(values)).toBe(false);
        const plan = planClassBalance(values, { strategy: 'auto' });
        expect(plan.mergeGroups).toHaveLength(0);
        expect(validateClassBalance(plan).ok).toBe(true);
    });

    it('handles titanic-like survived labels', () => {
        const values = [...Array(500).fill('0'), ...Array(300).fill('1')];
        const plan = planClassBalance(values, { strategy: 'auto' });
        expect(validateClassBalance(plan).ok).toBe(true);
    });

    it('handles string categorical datasets with rare classes', () => {
        const values = [
            ...Array(200).fill('setosa'),
            ...Array(180).fill('versicolor'),
            ...Array(5).fill('virginica'),
        ];
        expect(needsClassBalance(values)).toBe(true);
        const plan = planClassBalance(values, { strategy: 'auto' });
        expect(plan.passedValidation).toBe(true);
        expect(plan.final.distribution.every((entry) => entry.count >= 2)).toBe(true);
    });

    it('handles numeric ordinal labels passed as numbers', () => {
        const values = [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10];
        const plan = planClassBalance(values, { strategy: 'auto' });
        expect(plan.isOrdinal).toBe(true);
        expect(plan.passedValidation).toBe(true);
    });

    it('handles rows with missing target values', () => {
        const values = ['a', 'a', null, '', 'b', undefined, 'b', 'b', 'b'];
        const plan = planClassBalance(values, { strategy: 'auto' });
        expect(plan.original.total).toBe(6);
        expect(validateClassBalance(plan).ok).toBe(true);
    });

    it('documents merge reasoning in the audit report', () => {
        const qualities = loadWineQualities();
        const plan = planClassBalance(qualities, { strategy: 'merge' });
        const report = formatClassBalanceReport(plan);

        expect(plan.mergeGroups.length).toBeGreaterThan(0);
        expect(report).toContain('Merges:');
        expect(report).toContain('Original classes:');
        expect(report).toContain('Final classes:');
    });

    it('limits removal strategy to the 10% cap', () => {
        const values = Array.from({ length: 100 }, (_, index) => (index < 95 ? 'A' : 'B'));
        const plan = planClassBalance(values, { strategy: 'remove', minimumClassShare: 0.2 });
        expect(plan.removedFraction).toBeLessThanOrEqual(0.1);
    });

    it('drops unseen test labels not present in the training plan', () => {
        const plan = planClassBalance(['a', 'a', 'b', 'b'], { strategy: 'merge' });
        const result = applyClassBalanceToValues(['a', 'unknown'], plan);
        expect(result.values).toEqual(['a']);
        expect(result.droppedUnseen).toBe(1);
    });

    it('applies fitted plans consistently to rows without leaking test information', () => {
        const rows = [
            { quality: 3, x: 1 },
            { quality: '4', x: 2 },
            { quality: 5, x: 3 },
            { quality: '8', x: 4 },
        ];
        const trainLabels = [3, '4'];
        const plan = planClassBalance(trainLabels, { strategy: 'merge' });

        const trainApplied = applyClassBalanceToRows(rows.slice(0, 2), 'quality', plan);
        const testApplied = applyClassBalanceToRows(rows.slice(2), 'quality', plan);

        expect(trainApplied.rows.length).toBeGreaterThan(0);
        expect(testApplied.rows.every((row) => typeof row.quality === 'string')).toBe(true);
    });

    it('filters train/test splits using training-only plans', () => {
        const plan = planClassBalance(['1', '1', '2', '9'], { strategy: 'merge' });
        const xTrain = { values: [[1], [2], [3], [4]], columns: ['x'], iloc({ rows }) { const idx = rows[0].split(',').map(Number); return { values: idx.map((i) => this.values[i]), columns: this.columns }; } };
        const yTrain = { values: ['1', '1', '2', '9'], iloc(rowsSpec) { const idx = rowsSpec[0].split(',').map(Number); return { values: idx.map((i) => this.values[i]) }; } };
        const xTest = { values: [[5], [6]], columns: ['x'], iloc({ rows }) { const idx = rows[0].split(',').map(Number); return { values: idx.map((i) => this.values[i]), columns: this.columns }; } };
        const yTest = { values: ['1', 'unknown'], iloc(rowsSpec) { const idx = rowsSpec[0].split(',').map(Number); return { values: idx.map((i) => this.values[i]) }; } };

        const balanced = applyClassBalanceToSplit(xTrain, yTrain, xTest, yTest, plan);
        expect(balanced.yTrain.values.length).toBeGreaterThan(0);
        expect(balanced.yTest.values.length).toBeGreaterThan(0);
        expect(balanced.droppedUnseenTest).toBe(1);
    });

    it('works for non-ordinal categorical datasets via majority neighbor merge', () => {
        const values = ['cat', 'cat', 'cat', 'dog', 'dog', 'bird'];
        const plan = planClassBalance(values, { strategy: 'auto' });
        const { values: mapped } = applyClassBalanceToValues(values, plan);

        expect(mapped.length).toBeGreaterThan(0);
        expect(countClasses(mapped).size).toBeGreaterThanOrEqual(2);
    });

    it('summarizes before/after impact for reporting', () => {
        const qualities = loadWineQualities();
        const plan = planClassBalance(qualities, { strategy: 'auto' });
        const impact = summarizeBalanceImpact(plan);

        expect(impact.classesBefore).toBe(6);
        expect(impact.classesAfter).toBeLessThan(6);
        expect(impact.minorityShareAfter).toBeGreaterThanOrEqual(impact.minorityShareBefore);
        expect(impact.meetsMinimumShare).toBe(true);
    });

    it('exports merge groups for visualization sync', () => {
        const plan = planClassBalance(['1', '2', '2', '9'], { strategy: 'merge' });
        const transforms = planToClassTransformations(plan);
        expect(Array.isArray(transforms)).toBe(true);
    });

    it('compares distribution stats before and after on wine data', () => {
        const qualities = loadWineQualities();
        const before = distributionFromCounts(countClasses(qualities));
        const plan = planClassBalance(qualities, { strategy: 'auto' });
        const after = plan.final;

        expect(before.distribution.length).toBe(6);
        expect(Math.min(...before.distribution.map((entry) => entry.share))).toBeLessThan(0.05);
        expect(Math.min(...after.distribution.map((entry) => entry.share))).toBeGreaterThanOrEqual(0.05);
    });

    it('handles empty input without throwing', () => {
        const plan = planClassBalance([], { strategy: 'auto' });
        expect(plan.skipped).toBe(true);
        expect(plan.original.total).toBe(0);
    });
});
