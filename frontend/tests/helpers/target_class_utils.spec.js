import { describe, expect, it } from 'vitest';
import {
    applyClassMergeGroupsToValues,
    mergeGroupsAfterManualMerge,
    mergedLabelFromGroup,
    normalizeTargetLabel,
    removeMergeGroupByLabel,
    replaceTargetClassInValues,
    resolveSelectionToOriginalLabels,
    targetLabelsMatch,
} from '@/helpers/target_class_utils';

describe('target_class_utils', () => {
    it('normalizes numeric and string labels consistently', () => {
        expect(normalizeTargetLabel(6)).toBe('6');
        expect(normalizeTargetLabel('6')).toBe('6');
        expect(normalizeTargetLabel(' 7 ')).toBe('7');
        expect(targetLabelsMatch(6, '6')).toBe(true);
    });

    it('replaces classes when stored values are numbers but UI uses strings', () => {
        const values = [3, 4, 5, 6, 6, 7];
        const merged = replaceTargetClassInValues(values, '3', '3_4');
        expect(merged).toEqual(['3_4', 4, 5, 6, 6, 7]);

        const mergedNum = replaceTargetClassInValues(values, 4, '3_4');
        expect(mergedNum).toEqual([3, '3_4', 5, 6, 6, 7]);
    });

    it('applies merge groups from settings format', () => {
        const values = [3, 4, 5, 6, 7, 8, 3, 8];
        const groups = [
            [{ class: '3' }, { class: '4' }, { class: '8' }],
            [{ class: '6' }, { class: '7' }],
        ];
        const result = applyClassMergeGroupsToValues(values, groups);
        expect(result).toEqual([
            '3_4_8',
            '3_4_8',
            5,
            '6_7',
            '6_7',
            '3_4_8',
            '3_4_8',
            '3_4_8',
        ]);
    });

    it('resolves merged row selection to original labels', () => {
        const groups = [[{ class: '3' }, { class: '4' }], [{ class: '7' }, { class: '8' }]];
        const selected = [{ class: '3_4' }, { class: '5' }];
        expect(resolveSelectionToOriginalLabels(selected, groups)).toEqual(['3', '4', '5']);
    });

    it('replaces overlapping groups on manual merge', () => {
        const existing = [[{ class: '3' }, { class: '4' }], [{ class: '7' }, { class: '8' }]];
        const next = mergeGroupsAfterManualMerge(existing, ['3', '4', '5']);
        expect(next).toHaveLength(2);
        const labels = next.map((group) => mergedLabelFromGroup(group)).sort();
        expect(labels).toEqual(['3_4_5', '7_8']);
    });

    it('removes a merge group by label', () => {
        const groups = [[{ class: '3' }, { class: '4' }], [{ class: '7' }, { class: '8' }]];
        expect(removeMergeGroupByLabel(groups, '3_4')).toHaveLength(1);
        expect(mergedLabelFromGroup(removeMergeGroupByLabel(groups, '3_4')[0])).toBe('7_8');
    });

    it('normalizes boolean and string boolean labels', () => {
        expect(normalizeTargetLabel(true)).toBe('true');
        expect(normalizeTargetLabel(false)).toBe('false');
        expect(normalizeTargetLabel('True')).toBe('true');
        expect(targetLabelsMatch(true, 'true')).toBe(true);
        expect(targetLabelsMatch(1, '1')).toBe(true);
    });

    it('merges iris species string labels', () => {
        const values = ['setosa', 'versicolor', 'virginica', 'versicolor'];
        const groups = [[{ class: 'versicolor' }, { class: 'virginica' }]];
        expect(applyClassMergeGroupsToValues(values, groups)).toEqual([
            'setosa',
            'versicolor_virginica',
            'versicolor_virginica',
            'versicolor_virginica',
        ]);
    });

    it('merges binary 0/1 numeric labels', () => {
        const values = [0, 1, 0, 1, 1];
        const groups = [[{ class: '0' }, { class: '1' }]];
        expect(applyClassMergeGroupsToValues(values, groups)).toEqual([
            '0_1', '0_1', '0_1', '0_1', '0_1',
        ]);
    });
});
