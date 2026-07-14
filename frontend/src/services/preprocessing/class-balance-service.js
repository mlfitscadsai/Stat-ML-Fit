/**
 * Reusable class-balance preprocessing for classification targets.
 *
 * Supports ordinal-aware merging, optional class removal, leakage-safe
 * fit/transform usage, validation gates, and audit logging.
 */

export const DEFAULT_CLASS_BALANCE_OPTIONS = {
    /** Classes below this share of total samples are underrepresented. */
    underrepresentedThreshold: 0.05,
    /** Minimum share each resulting class must reach after balancing. */
    minimumClassShare: 0.15,
    /** Maximum fraction of original rows that may be removed. */
    maxRemovalFraction: 0.10,
    /** auto | merge | remove | merge_then_remove */
    strategy: 'auto',
    /** Minimum number of distinct classes to preserve after balancing. */
    minClasses: 2,
    /** Minimum samples any remaining class must have to keep training viable. */
    minSamplesPerClass: 2,
};

function isMissing(value) {
    return value === null || value === undefined || value === '' || Number.isNaN(value);
}

/**
 * Canonical class label for counting, merging, and mapping.
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeClassLabel(value) {
    if (isMissing(value)) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        if (Number.isInteger(value)) return String(value);
        return String(value);
    }
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && String(numeric) === trimmed) {
        return String(numeric);
    }
    return trimmed;
}

/**
 * @param {Array<unknown>} values
 * @returns {Map<string, number>}
 */
export function countClasses(values) {
    const counts = new Map();
    for (const value of values) {
        const key = normalizeClassLabel(value);
        if (key == null) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
}

/**
 * @param {Map<string, number>} counts
 * @returns {{ total: number, distribution: Array<{ label: string, count: number, share: number }> }}
 */
export function distributionFromCounts(counts) {
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    const distribution = [...counts.entries()]
        .map(([label, count]) => ({
            label,
            count,
            share: total ? count / total : 0,
        }))
        .sort((a, b) => compareLabels(a.label, b.label));
    return { total, distribution };
}

/**
 * Detect whether all class labels are numeric (ordinal semantics).
 * @param {string[]} labels
 */
export function detectOrdinalLabels(labels) {
    if (!labels.length) return false;
    return labels.every((label) => {
        const parsed = Number(label);
        return Number.isFinite(parsed) && String(parsed) === label.trim();
    });
}

function compareLabels(a, b) {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
}

function createGroupName(members, isOrdinal) {
    const sorted = [...members].sort(compareLabels);
    return isOrdinal ? sorted.join('_') : sorted.join('_plus_');
}

function buildGroups(counts, isOrdinal) {
    return [...counts.entries()].map(([label, count]) => ({
        members: [label],
        count,
        name: label,
        isOrdinal,
    }));
}

function groupsToDistribution(groups, total) {
    return groups
        .map((group) => ({
            label: group.name,
            count: group.count,
            share: total ? group.count / total : 0,
        }))
        .sort((a, b) => compareLabels(a.label, b.label));
}

function ordinalNeighbor(group, groups) {
    const values = group.members.map(Number);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    let best = null;
    let bestDistance = Infinity;

    for (const candidate of groups) {
        if (candidate === group) continue;
        const candidateMin = Math.min(...candidate.members.map(Number));
        const candidateMax = Math.max(...candidate.members.map(Number));
        const distance = Math.min(
            Math.abs(candidateMin - maxValue),
            Math.abs(candidateMax - minValue),
        );
        if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
        }
    }
    return best;
}

function categoricalNeighbor(group, groups) {
    let best = null;
    let bestCount = -1;
    for (const candidate of groups) {
        if (candidate === group) continue;
        if (candidate.count > bestCount) {
            bestCount = candidate.count;
            best = candidate;
        }
    }
    return best;
}

function mergeGroups(source, target, mergeGroupsLog, reason) {
    target.members = [...new Set([...target.members, ...source.members])].sort(compareLabels);
    target.count += source.count;
    target.name = createGroupName(target.members, target.isOrdinal);
    mergeGroupsLog.push({
        mergedLabels: [...source.members],
        newLabel: target.name,
        reason,
    });
}

function buildLabelMap(groups, removedOriginalLabels) {
    const labelMap = new Map();
    for (const group of groups) {
        for (const member of group.members) {
            labelMap.set(member, group.name);
        }
    }
    for (const removed of removedOriginalLabels) {
        labelMap.set(removed, null);
    }
    return labelMap;
}

function resolveMappedLabel(label, labelMap) {
    const key = normalizeClassLabel(label);
    if (key == null) return null;
    if (!labelMap.has(key)) return key;
    const mapped = labelMap.get(key);
    return mapped == null ? null : mapped;
}

function getEffectiveMinimumShare(finalClassCount, config) {
    if (finalClassCount <= 2) {
        return config.underrepresentedThreshold;
    }
    return config.minimumClassShare;
}

function distributionMeetsMinimum(distribution, total, config) {
    if (!distribution.length) return false;
    const effectiveMinShare = getEffectiveMinimumShare(distribution.length, config);
    return distribution.every(
        (entry) => entry.share >= effectiveMinShare
            && entry.count >= config.minSamplesPerClass,
    );
}

function createIdentityPlan(original, config, logMessage, extra = {}) {
    const labels = original.distribution.map((entry) => entry.label);
    return {
        strategy: 'none',
        skipped: true,
        labelMap: new Map(labels.map((label) => [label, label])),
        removedLabels: [],
        mergeGroups: [],
        original,
        final: original,
        removedCount: 0,
        removedFraction: 0,
        isOrdinal: detectOrdinalLabels(labels),
        log: [logMessage],
        passedValidation: distributionMeetsMinimum(original.distribution, original.total, config),
        ...extra,
    };
}

/**
 * Returns true when automated balancing should run for these target values.
 * @param {Array<unknown>} targetValues
 * @param {Partial<typeof DEFAULT_CLASS_BALANCE_OPTIONS>} options
 */
export function needsClassBalance(targetValues, options = {}) {
    const config = { ...DEFAULT_CLASS_BALANCE_OPTIONS, ...options };
    const original = distributionFromCounts(countClasses(targetValues));
    if (original.distribution.length <= 1) return false;
    if (distributionMeetsMinimum(original.distribution, original.total, config)) {
        return false;
    }
    if (original.distribution.length === 2) {
        const minorityShare = Math.min(...original.distribution.map((entry) => entry.share));
        if (minorityShare < config.underrepresentedThreshold) {
            return false;
        }
    }
    return true;
}

/**
 * Plan class-balance transformations from target values (typically training labels only).
 *
 * @param {Array<unknown>} targetValues
 * @param {Partial<typeof DEFAULT_CLASS_BALANCE_OPTIONS>} options
 */
export function planClassBalance(targetValues, options = {}) {
    const config = { ...DEFAULT_CLASS_BALANCE_OPTIONS, ...options };
    const safeValues = Array.isArray(targetValues) ? targetValues : [];
    const originalCounts = countClasses(safeValues);
    const original = distributionFromCounts(originalCounts);

    if (!original.total) {
        return createIdentityPlan(
            original,
            config,
            'Skipped class balancing: no usable target values.',
            { passedValidation: false },
        );
    }

    if (original.distribution.length <= 1) {
        return createIdentityPlan(
            original,
            config,
            'Skipped class balancing: fewer than two classes present.',
        );
    }

    if (distributionMeetsMinimum(original.distribution, original.total, config)) {
        return createIdentityPlan(
            original,
            config,
            'No balancing needed: all classes already meet minimum share and sample count.',
            { skipped: false },
        );
    }

    const isOrdinal = detectOrdinalLabels([...originalCounts.keys()]);

    if (original.distribution.length === 2) {
        const minorityShare = Math.min(...original.distribution.map((entry) => entry.share));
        if (minorityShare < config.underrepresentedThreshold) {
            return createIdentityPlan(
                original,
                config,
                'Skipped class balancing: binary target would collapse to one class if merged or removed. Use macro F1 and class-weighted models.',
                { skipReason: 'binary_collapse_risk', passedValidation: true },
            );
        }
    }

    const totalRows = original.total;
    const maxRemovable = Math.floor(totalRows * config.maxRemovalFraction);
    const mergeGroupsLog = [];
    const log = [];
    const removedOriginalLabels = new Set();
    let removedCount = 0;

    const allowMerge = config.strategy === 'merge'
        || config.strategy === 'merge_then_remove'
        || config.strategy === 'auto';
    const allowRemove = config.strategy === 'remove'
        || config.strategy === 'merge_then_remove'
        || config.strategy === 'auto';

    let groups = buildGroups(originalCounts, isOrdinal);

    function distribution() {
        return {
            total: totalRows - removedCount,
            distribution: groupsToDistribution(groups, totalRows - removedCount),
        };
    }

    function mergeWithNeighbor(group, reasonPrefix) {
        if (groups.length <= config.minClasses) {
            return false;
        }
        const neighbor = isOrdinal
            ? ordinalNeighbor(group, groups)
            : categoricalNeighbor(group, groups);
        if (!neighbor || neighbor === group) return false;

        mergeGroups(
            group,
            neighbor,
            mergeGroupsLog,
            `${reasonPrefix}: merged [${group.members.join(', ')}] into [${neighbor.members.join(', ')}] → '${neighbor.name}'`,
        );
        log.push(mergeGroupsLog[mergeGroupsLog.length - 1].reason);
        groups = groups.filter((item) => item !== group);
        return true;
    }

    function removeGroup(group, reason) {
        if (!allowRemove) return false;
        if (removedCount + group.count > maxRemovable) {
            log.push(`Removal blocked for '${group.name}': would exceed ${(config.maxRemovalFraction * 100).toFixed(0)}% cap.`);
            return false;
        }
        if (groups.length - 1 < config.minClasses) {
            log.push(`Removal blocked for '${group.name}': would leave fewer than ${config.minClasses} classes.`);
            return false;
        }
        group.members.forEach((label) => removedOriginalLabels.add(label));
        removedCount += group.count;
        groups = groups.filter((item) => item !== group);
        log.push(`Removed class group '${group.name}' (${group.count} samples, ${((group.count / totalRows) * 100).toFixed(2)}%): ${reason}`);
        return true;
    }

    // Phase 1: merge underrepresented classes (<5%) with semantic neighbors.
    if (allowMerge) {
        let guard = 0;
        while (guard < 100) {
            guard += 1;
            const current = distribution().distribution;
            const under = current.filter((entry) => entry.share < config.underrepresentedThreshold);
            if (!under.length) break;

            const target = under.sort((a, b) => a.share - b.share)[0];
            const group = groups.find((item) => item.name === target.label);
            if (!group) break;
            if (!mergeWithNeighbor(group, 'Underrepresented class merge')) break;
        }
    }

    // Phase 2: enforce minimum class share via merge, then optional removal.
    let guard = 0;
    while (guard < 100) {
        guard += 1;
        const current = distribution().distribution;
        const effectiveMinShare = getEffectiveMinimumShare(current.length, config);
        const belowMin = current.filter(
            (entry) => entry.share < effectiveMinShare || entry.count < config.minSamplesPerClass,
        );
        if (!belowMin.length) break;

        const target = belowMin.sort((a, b) => a.share - b.share)[0];
        const group = groups.find((item) => item.name === target.label);
        if (!group) break;

        if (allowMerge && groups.length > config.minClasses) {
            if (mergeWithNeighbor(group, 'Minimum share enforcement')) continue;
        }

        if (allowRemove) {
            if (removeGroup(group, `share ${(target.share * 100).toFixed(2)}% below ${(effectiveMinShare * 100).toFixed(0)}% minimum`)) {
                continue;
            }
        }
        break;
    }

    const labelMapEntries = buildLabelMap(groups, removedOriginalLabels);
    const labelMap = new Map();
    for (const [label, mapped] of labelMapEntries.entries()) {
        labelMap.set(label, mapped);
    }

    const final = distribution();
    const effectiveMinShare = getEffectiveMinimumShare(final.distribution.length, config);
    const passedValidation = final.distribution.every(
        (entry) => entry.share >= effectiveMinShare && entry.count >= config.minSamplesPerClass,
    )
        && removedCount <= maxRemovable
        && final.distribution.length >= config.minClasses;

    if (!passedValidation) {
        const offenders = final.distribution
            .filter(
                (entry) => entry.share < effectiveMinShare || entry.count < config.minSamplesPerClass,
            )
            .map((entry) => `${entry.label} (${(entry.share * 100).toFixed(2)}%, n=${entry.count})`);
        if (offenders.length) {
            log.push(`Validation warning: classes below effective minimum remain: ${offenders.join(', ')}`);
        }
    } else {
        log.push('Class balance validation passed.');
    }

    return {
        strategy: config.strategy,
        skipped: false,
        labelMap,
        removedLabels: [...removedOriginalLabels],
        mergeGroups: mergeGroupsLog,
        original,
        final,
        removedCount,
        removedFraction: totalRows ? removedCount / totalRows : 0,
        isOrdinal,
        log,
        passedValidation,
    };
}

/**
 * Apply a fitted plan to target values.
 * @returns {{ values: Array<string>, keptIndices: number[], droppedUnseen: number }}
 */
export function applyClassBalanceToValues(targetValues, plan) {
    const keptIndices = [];
    const values = [];
    let droppedUnseen = 0;
    const knownOriginalLabels = new Set(plan.original.distribution.map((entry) => entry.label));

    (Array.isArray(targetValues) ? targetValues : []).forEach((value, index) => {
        const label = normalizeClassLabel(value);
        if (label == null) return;

        if (!knownOriginalLabels.has(label) && !plan.labelMap.has(label)) {
            droppedUnseen += 1;
            return;
        }

        const mapped = resolveMappedLabel(label, plan.labelMap);
        if (mapped == null || plan.removedLabels.includes(label)) return;

        keptIndices.push(index);
        values.push(mapped);
    });

    return { values, keptIndices, droppedUnseen };
}

/**
 * Apply plan to tabular rows, returning filtered rows and audit metadata.
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} targetColumn
 * @param {ReturnType<typeof planClassBalance>} plan
 */
export function applyClassBalanceToRows(rows, targetColumn, plan) {
    const filtered = [];
    let removedByClass = 0;
    let relabeled = 0;
    let droppedUnseen = 0;
    const knownOriginalLabels = new Set(plan.original.distribution.map((entry) => entry.label));

    for (const row of rows) {
        const raw = row?.[targetColumn];
        const label = normalizeClassLabel(raw);
        if (label == null) continue;

        if (!knownOriginalLabels.has(label) && !plan.labelMap.has(label)) {
            droppedUnseen += 1;
            continue;
        }

        const mapped = resolveMappedLabel(label, plan.labelMap);
        if (mapped == null || plan.removedLabels.includes(label)) {
            removedByClass += 1;
            continue;
        }
        if (mapped !== label) relabeled += 1;
        filtered.push({ ...row, [targetColumn]: mapped });
    }

    return {
        rows: filtered,
        removedByClass,
        relabeled,
        droppedUnseen,
        finalDistribution: distributionFromCounts(countClasses(filtered.map((row) => row[targetColumn]))),
    };
}

/**
 * Filter aligned feature/target frames using kept indices.
 * @param {object} xFrame danfo DataFrame
 * @param {object} ySeries danfo Series
 * @param {number[]} keptIndices
 */
export function filterFramesByIndices(xFrame, ySeries, keptIndices) {
    if (!keptIndices.length) {
        throw new Error('Class balancing removed all rows. Relax removal limits or adjust merge strategy.');
    }
    const rowSpec = keptIndices.length === 1 ? String(keptIndices[0]) : keptIndices.join(',');
    return [
        xFrame.iloc({ rows: [rowSpec] }),
        ySeries.iloc([rowSpec]),
    ];
}

/**
 * Apply class-balance plan to train/test splits without leakage.
 * Plan must be fitted on training labels only.
 */
export function applyClassBalanceToSplit(xTrain, yTrain, xTest, yTest, plan) {
    const trainResult = applyClassBalanceToValues(yTrain.values ?? yTrain, plan);
    const testResult = applyClassBalanceToValues(yTest.values ?? yTest, plan);

    const [balancedXTrain, balancedYTrain] = filterFramesByIndices(xTrain, yTrain, trainResult.keptIndices);

    let balancedXTest = xTest;
    let balancedYTest = yTest;
    if (testResult.keptIndices.length > 0) {
        [balancedXTest, balancedYTest] = filterFramesByIndices(xTest, yTest, testResult.keptIndices);
    } else {
        balancedXTest = {
            ...xTest,
            values: [],
            columns: xTest.columns,
        };
        balancedYTest = {
            ...yTest,
            values: [],
        };
    }

    return {
        xTrain: balancedXTrain,
        yTrain: balancedYTrain,
        xTest: balancedXTest,
        yTest: balancedYTest,
        trainDistribution: distributionFromCounts(countClasses(trainResult.values)),
        testDistribution: distributionFromCounts(countClasses(testResult.values)),
        droppedUnseenTest: testResult.droppedUnseen,
    };
}

export function validateClassBalance(plan, options = {}) {
    const config = { ...DEFAULT_CLASS_BALANCE_OPTIONS, ...options };
    const issues = [];

    if (plan.skipped) {
        return {
            ok: plan.passedValidation !== false,
            issues: plan.passedValidation === false ? ['Class balancing was skipped.'] : [],
        };
    }

    if (plan.removedFraction > config.maxRemovalFraction) {
        issues.push(`Removed ${(plan.removedFraction * 100).toFixed(2)}% of rows (limit ${(config.maxRemovalFraction * 100).toFixed(0)}%).`);
    }
    if (plan.final.distribution.length < config.minClasses) {
        issues.push(`Only ${plan.final.distribution.length} class(es) remain after balancing.`);
    }

    const effectiveMinShare = getEffectiveMinimumShare(plan.final.distribution.length, config);
    for (const entry of plan.final.distribution) {
        if (entry.share < effectiveMinShare) {
            issues.push(
                `Class '${entry.label}' is ${(entry.share * 100).toFixed(2)}% `
                + `(minimum ${(effectiveMinShare * 100).toFixed(0)}%).`,
            );
        }
        if (entry.count < config.minSamplesPerClass) {
            issues.push(`Class '${entry.label}' has only ${entry.count} sample(s).`);
        }
    }
    if (plan.final.distribution.length < 2) {
        issues.push('Insufficient classes for classification after balancing.');
    }

    return {
        ok: issues.length === 0,
        issues,
    };
}

export function formatClassBalanceReport(plan) {
    const lines = [
        'Class balance report',
        `Strategy: ${plan.strategy}${plan.isOrdinal ? ' (ordinal)' : ''}`,
        plan.skipped ? 'Status: skipped (identity mapping applied)' : 'Status: applied',
        `Original classes: ${plan.original.distribution.length}, samples: ${plan.original.total}`,
    ];

    plan.original.distribution.forEach((entry) => {
        lines.push(`  • ${entry.label}: ${entry.count} (${(entry.share * 100).toFixed(2)}%)`);
    });

    if (plan.mergeGroups.length) {
        lines.push('Merges:');
        plan.mergeGroups.forEach((group) => {
            lines.push(`  • ${group.mergedLabels.join(' + ')} → ${group.newLabel}: ${group.reason}`);
        });
    }

    if (plan.removedLabels.length) {
        lines.push(`Removed original classes: ${plan.removedLabels.join(', ')} (${plan.removedCount} samples, ${(plan.removedFraction * 100).toFixed(2)}%)`);
    }

    lines.push(`Final classes: ${plan.final.distribution.length}, samples: ${plan.final.total}`);
    plan.final.distribution.forEach((entry) => {
        lines.push(`  • ${entry.label}: ${entry.count} (${(entry.share * 100).toFixed(2)}%)`);
    });

    plan.log.forEach((entry) => lines.push(`Log: ${entry}`));
    return lines.join('\n');
}

/**
 * Convert a balance plan into the store's classTransformations format
 * used by visualization components.
 */
export function planToClassTransformations(plan) {
    return plan.mergeGroups.map((group) =>
        group.mergedLabels.map((label) => ({ class: label })),
    );
}

/**
 * Compare simple classification readiness before/after balancing.
 */
export function summarizeBalanceImpact(plan) {
    const beforeMin = plan.original.distribution.length
        ? Math.min(...plan.original.distribution.map((entry) => entry.share))
        : 0;
    const afterMin = plan.final.distribution.length
        ? Math.min(...plan.final.distribution.map((entry) => entry.share))
        : 0;

    const effectiveMinShare = getEffectiveMinimumShare(plan.final.distribution.length, DEFAULT_CLASS_BALANCE_OPTIONS);

    return {
        classesBefore: plan.original.distribution.length,
        classesAfter: plan.final.distribution.length,
        minorityShareBefore: beforeMin,
        minorityShareAfter: afterMin,
        removedSamples: plan.removedCount,
        mergedGroups: plan.mergeGroups.length,
        skipped: Boolean(plan.skipped),
        improvedMinorityShare: afterMin >= beforeMin,
        meetsMinimumShare: plan.final.distribution.every(
            (entry) => entry.share >= effectiveMinShare
                && entry.count >= DEFAULT_CLASS_BALANCE_OPTIONS.minSamplesPerClass,
        ),
    };
}
