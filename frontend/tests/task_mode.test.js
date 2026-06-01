import { test, expect } from 'vitest';
import { FeatureCategories } from '../src/helpers/settings.js';
import {
    TASK_MODES,
    detectTaskFromTarget,
    resolveTaskMode,
    validateModeCompatibility,
} from '../src/helpers/task_mode.js';

test('detectTaskFromTarget identifies numeric discrete targets as classification', () => {
    const isClassification = detectTaskFromTarget(
        FeatureCategories.Numerical.id,
        [0, 1, 0, 1, 1, 0, 2]
    );
    expect(isClassification).toBe(true);
});

test('detectTaskFromTarget identifies numeric continuous targets as regression', () => {
    const isClassification = detectTaskFromTarget(
        FeatureCategories.Numerical.id,
        [0.12, 2.31, 9.75, 4.44, 7.93, 10.27]
    );
    expect(isClassification).toBe(false);
});

test('resolveTaskMode honors explicit user mode over auto-detect', () => {
    expect(resolveTaskMode(TASK_MODES.CLASSIFICATION, false)).toBe(true);
    expect(resolveTaskMode(TASK_MODES.REGRESSION, true)).toBe(false);
    expect(resolveTaskMode(TASK_MODES.AUTO, true)).toBe(true);
});

test('validateModeCompatibility blocks regression on categorical target', () => {
    const validation = validateModeCompatibility(
        TASK_MODES.REGRESSION,
        FeatureCategories.Nominal.id,
        ['A', 'B', 'A']
    );
    expect(validation.valid).toBe(false);
    expect(validation.message).toMatch(/numerical target/i);
});

test('validateModeCompatibility blocks classification on continuous target', () => {
    const validation = validateModeCompatibility(
        TASK_MODES.CLASSIFICATION,
        FeatureCategories.Numerical.id,
        [1.2, 3.1, 4.9, 6.3, 7.8, 9.0, 10.4]
    );
    expect(validation.valid).toBe(false);
    expect(validation.message).toMatch(/continuous/i);
});

test('validateModeCompatibility allows auto mode regardless of target type', () => {
    const validation = validateModeCompatibility(
        TASK_MODES.AUTO,
        FeatureCategories.Nominal.id,
        ['cat', 'dog', 'cat']
    );
    expect(validation.valid).toBe(true);
});
