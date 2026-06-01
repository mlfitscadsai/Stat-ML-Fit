export function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

export function averagePathLength(n) {
    if (n <= 1) return 0;
    if (n === 2) return 1;
    const harmonic = Math.log(n - 1) + 0.5772156649;
    return 2 * harmonic - (2 * (n - 1)) / n;
}

export function isolationPathLength(sample, value, depth, maxDepth, random) {
    if (depth >= maxDepth || sample.length <= 1) {
        return depth + averagePathLength(sample.length);
    }
    let min = Infinity;
    let max = -Infinity;
    for (const v of sample) {
        if (v < min) min = v;
        if (v > max) max = v;
    }
    if (min === max) {
        return depth + averagePathLength(sample.length);
    }

    const split = min + random() * (max - min);
    const left = [];
    const right = [];
    for (const v of sample) {
        if (v < split) left.push(v);
        else right.push(v);
    }
    return value < split
        ? isolationPathLength(left, value, depth + 1, maxDepth, random)
        : isolationPathLength(right, value, depth + 1, maxDepth, random);
}

export function detectIsolationForest(vals) {
    const n = vals.length;
    const sampleSize = Math.min(64, n);
    const treeCount = Math.min(80, Math.max(40, n));
    const maxDepth = Math.ceil(Math.log2(sampleSize));
    const c = averagePathLength(sampleSize) || 1;
    const scores = vals.map((value, rowIndex) => {
        let pathTotal = 0;
        for (let tree = 0; tree < treeCount; tree++) {
            const random = seededRandom((rowIndex + 1) * 73856093 ^ (tree + 1) * 19349663);
            const sample = [];
            for (let i = 0; i < sampleSize; i++) {
                sample.push(vals[Math.floor(random() * n)]);
            }
            pathTotal += isolationPathLength(sample, value, 0, maxDepth, random);
        }
        const avgPath = pathTotal / treeCount;
        return Math.pow(2, -avgPath / c);
    });
    const threshold = 0.62;
    return {
        outliers: vals.filter((_, i) => scores[i] >= threshold),
        scoreThreshold: threshold,
        maxIsolationScore: Math.max(...scores),
    };
}

export function detectOutliers(values, method, threshold) {
    const vals = values.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
    if (vals.length < 4) return null;

    const sorted = [...vals].sort((a, b) => a - b);
    const q = (p) => {
        const idx = (sorted.length - 1) * p;
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        if (lo === hi) return sorted[lo];
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    };
    const q1 = q(0.25), q2 = q(0.5), q3 = q(0.75);
    const iqr = q3 - q1;
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, vals.length - 1);
    const std = Math.sqrt(variance);

    let lower, upper, outliers;
    let scoreThreshold;
    let maxIsolationScore;
    if (method === 'zscore') {
        const t = threshold || 3;
        lower = mean - t * std;
        upper = mean + t * std;
        outliers = std === 0 ? [] : vals.filter((v) => Math.abs((v - mean) / std) > t);
    } else if (method === 'mad') {
        const deviations = vals.map((v) => Math.abs(v - q2)).sort((a, b) => a - b);
        const madRaw = deviations[Math.floor(deviations.length / 2)] || 0;
        const mad = madRaw * 1.4826;
        const t = threshold || 3.5;
        lower = mad === 0 ? q2 : q2 - t * mad;
        upper = mad === 0 ? q2 : q2 + t * mad;
        outliers = mad === 0 ? [] : vals.filter((v) => Math.abs(0.6745 * (v - q2) / madRaw) > t);
    } else if (method === 'isolation') {
        const detection = detectIsolationForest(vals);
        lower = q1 - 1.5 * iqr;
        upper = q3 + 1.5 * iqr;
        outliers = detection.outliers;
        scoreThreshold = detection.scoreThreshold;
        maxIsolationScore = detection.maxIsolationScore;
    } else {
        // default to iqr
        const t = threshold || 1.5;
        lower = q1 - t * iqr;
        upper = q3 + t * iqr;
        outliers = vals.filter((v) => v < lower || v > upper);
    }

    const outlierSorted = [...outliers].sort((a, b) => a - b);
    return {
        count: outliers.length,
        pct: +(((outliers.length / vals.length) * 100).toFixed(2)),
        lowerBound: lower,
        upperBound: upper,
        minOutlier: outlierSorted[0],
        maxOutlier: outlierSorted[outlierSorted.length - 1],
        sample: outlierSorted.slice(0, 8),
        mean,
        median: q2,
        std,
        scoreThreshold,
        maxIsolationScore,
    };
}

export function getOutlierFlags(values, method, threshold) {
    const vals = values.map(v => (v !== null && v !== undefined && Number.isFinite(v)) ? Number(v) : NaN);
    const validVals = vals.filter(v => !isNaN(v));
    if (validVals.length < 4) {
        return new Array(vals.length).fill(false);
    }

    const sorted = [...validVals].sort((a, b) => a - b);
    const q = (p) => {
        const idx = (sorted.length - 1) * p;
        const lo = Math.floor(idx);
        const hi = Math.ceil(idx);
        if (lo === hi) return sorted[lo];
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    };
    const q1 = q(0.25), q2 = q(0.5), q3 = q(0.75);
    const iqr = q3 - q1;
    const mean = validVals.reduce((s, v) => s + v, 0) / validVals.length;
    const variance = validVals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, validVals.length - 1);
    const std = Math.sqrt(variance);

    if (method === 'zscore') {
        const t = threshold || 3;
        if (std === 0) return new Array(vals.length).fill(false);
        return vals.map(v => isNaN(v) ? false : Math.abs((v - mean) / std) > t);
    } else if (method === 'mad') {
        const deviations = validVals.map((v) => Math.abs(v - q2)).sort((a, b) => a - b);
        const madRaw = deviations[Math.floor(deviations.length / 2)] || 0;
        const t = threshold || 3.5;
        if (madRaw === 0) return new Array(vals.length).fill(false);
        return vals.map(v => isNaN(v) ? false : Math.abs(0.6745 * (v - q2) / madRaw) > t);
    } else if (method === 'isolation') {
        const detection = detectIsolationForest(validVals);
        const outlierSet = new Set(detection.outliers);
        return vals.map(v => isNaN(v) ? false : outlierSet.has(v));
    } else {
        const t = threshold || 1.5;
        const lower = q1 - t * iqr;
        const upper = q3 + t * iqr;
        return vals.map(v => isNaN(v) ? false : (v < lower || v > upper));
    }
}

export function filterOutliersFromDataFrame(df, numericColumns, method, threshold) {
    if (!df || !numericColumns || !numericColumns.length) return df;

    const rowCount = df.$data.length;
    const isOutlierRow = new Array(rowCount).fill(false);

    for (const col of numericColumns) {
        if (!df.columns.includes(col)) continue;
        const colValues = df[col].values;
        const flags = getOutlierFlags(colValues, method, threshold);
        for (let i = 0; i < rowCount; i++) {
            if (flags[i]) {
                isOutlierRow[i] = true;
            }
        }
    }

    const cleanIndices = [];
    for (let i = 0; i < rowCount; i++) {
        if (!isOutlierRow[i]) {
            cleanIndices.push(i);
        }
    }

    return df.iloc({ rows: cleanIndices });
}
