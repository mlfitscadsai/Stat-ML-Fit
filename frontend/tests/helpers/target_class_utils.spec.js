import { describe, expect, it } from 'vitest';
import {
    applyClassMergeGroupsToValues,
    normalizeTargetLabel,
    replaceTargetClassInValues,
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
});
