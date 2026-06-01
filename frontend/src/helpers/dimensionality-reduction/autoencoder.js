let tfModule = null;

async function getTf() {
    if (!tfModule) {
        const tf = await import('@tensorflow/tfjs');
        await import('@tensorflow/tfjs-backend-cpu');
        await import('@tensorflow/tfjs-backend-webgl');
        tfModule = tf;
    }
    return tfModule;
}

export default class Autoencoder {
    normalizeActivation(value, fallback = "relu") {
        const allowed = new Set([
            "linear", "relu", "sigmoid", "tanh", "elu", "selu", "softplus", "softsign",
        ]);
        const act = String(value || "").toLowerCase().trim();
        return allowed.has(act) ? act : fallback;
    }

    async ensureBackend() {
        const tf = await getTf();
        await tf.ready();
        const backends = tf.engine().registry ? Object.keys(tf.engine().registry) : [];
        const hasWebgl = backends.includes("webgl");
        const hasCpu = backends.includes("cpu");
        if (hasWebgl && tf.getBackend() !== "webgl") {
            try { await tf.setBackend("webgl"); await tf.ready(); return; } catch (_) {}
        }
        if (hasCpu && tf.getBackend() !== "cpu") {
            await tf.setBackend("cpu"); await tf.ready();
        }
    }

    async predict(
        x,
        latentSize,
        epochs,
        encoderLayers,
        latentActivation,
        decoderOutputActivation,
        seed = 123,
        learningRate = 0.01,
        optimizer = "adam",
        onEpoch = null
    ) {
        const tf = await getTf();
        const safeLatent = Math.max(2, Number(latentSize) || 2);
        const safeEpochs = Math.max(1, Number(epochs) || 100);
        const safeSeed = Math.max(0, Math.floor(Number(seed) || 123));
        const safeLR = Math.max(1e-5, Math.min(1, Number(learningRate) || 0.01));
        const latentAct = this.normalizeActivation(latentActivation, "relu");
        const decOutAct = this.normalizeActivation(decoderOutputActivation, "linear");

        const hiddenLayers = Array.isArray(encoderLayers) && encoderLayers.length > 0
            ? encoderLayers.map((l) => ({
                units: Math.max(2, Number(l.units) || 32),
                activation: this.normalizeActivation(l.activation, "relu"),
            }))
            : [{ units: 32, activation: "relu" }];

        let inputData = Array.isArray(x)
            ? x.map(row => (Array.isArray(row) ? row : [row]).map(v => Number(v))).filter(row => row.every(Number.isFinite))
            : [];
        if (!inputData.length || !inputData[0]?.length) throw new Error("Autoencoder received empty numeric input.");
        const inputDim = inputData[0].length;
        inputData = inputData.filter(row => row.length === inputDim);
        if (inputData.length < 2) throw new Error("Autoencoder needs at least 2 valid rows.");

        let inputTensor, meanTensor, varianceTensor, stdTensor, normalizedTensor, encodedTensor, autoencoder, encoderModel;
        const historyLoss = [], historyValLoss = [];

        try {
            await this.ensureBackend();

            inputTensor = tf.tensor2d(inputData, [inputData.length, inputDim], "float32");
            ({ mean: meanTensor, variance: varianceTensor } = tf.moments(inputTensor, 0));
            stdTensor = tf.tidy(() => varianceTensor.sqrt().add(1e-7));
            normalizedTensor = tf.tidy(() => inputTensor.sub(meanTensor).div(stdTensor));

            const inputLayer = tf.input({ shape: [inputDim] });
            let enc = inputLayer;
            let seedOffset = 0;
            for (const hl of hiddenLayers) {
                enc = tf.layers.dense({
                    units: Math.min(hl.units, inputDim * 4),
                    activation: hl.activation,
                    kernelInitializer: tf.initializers.glorotUniform({ seed: safeSeed + seedOffset }),
                    biasInitializer: tf.initializers.zeros(),
                }).apply(enc);
                seedOffset++;
            }
            const bottleneck = tf.layers.dense({
                units: Math.min(safeLatent, inputDim),
                activation: latentAct,
                kernelInitializer: tf.initializers.glorotUniform({ seed: safeSeed + seedOffset }),
                biasInitializer: tf.initializers.zeros(),
                name: "bottleneck",
            }).apply(enc);
            seedOffset++;

            let dec = bottleneck;
            for (let i = hiddenLayers.length - 1; i >= 0; i--) {
                dec = tf.layers.dense({
                    units: Math.min(hiddenLayers[i].units, inputDim * 4),
                    activation: hiddenLayers[i].activation,
                    kernelInitializer: tf.initializers.glorotUniform({ seed: safeSeed + seedOffset }),
                    biasInitializer: tf.initializers.zeros(),
                }).apply(dec);
                seedOffset++;
            }
            const output = tf.layers.dense({
                units: inputDim,
                activation: decOutAct,
                kernelInitializer: tf.initializers.glorotUniform({ seed: safeSeed + seedOffset }),
                biasInitializer: tf.initializers.zeros(),
                name: "decoder_output",
            }).apply(dec);

            autoencoder = tf.model({ inputs: inputLayer, outputs: output });
            encoderModel = tf.model({ inputs: inputLayer, outputs: bottleneck });

            let tfOptimizer;
            switch (String(optimizer).toLowerCase()) {
                case "rmsprop": tfOptimizer = tf.train.rmsprop(safeLR); break;
                case "sgd":     tfOptimizer = tf.train.sgd(safeLR); break;
                default:        tfOptimizer = tf.train.adam(safeLR);
            }
            autoencoder.compile({ optimizer: tfOptimizer, loss: "meanSquaredError" });

            const hasVal = inputData.length > 20;
            await autoencoder.fit(normalizedTensor, normalizedTensor, {
                epochs: safeEpochs,
                batchSize: Math.max(1, Math.min(32, inputData.length)),
                shuffle: true,
                validationSplit: hasVal ? 0.1 : 0,
                verbose: 0,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        historyLoss.push(Number((logs.loss || 0).toFixed(6)));
                        if (hasVal && logs.val_loss != null) historyValLoss.push(Number((logs.val_loss || 0).toFixed(6)));
                        if (typeof onEpoch === "function") onEpoch(epoch + 1, safeEpochs, logs.loss);
                    },
                },
            });

            const rawOut = encoderModel.predict(normalizedTensor);
            encodedTensor = Array.isArray(rawOut) ? rawOut[0] : rawOut;
            const encodedValues = await encodedTensor.array();

            return {
                encoded: encodedValues,
                history: { loss: historyLoss, valLoss: historyValLoss },
                latentDim: encodedValues[0]?.length ?? safeLatent,
            };
        } catch (e) {
            throw new Error("Failed to fit TensorFlow autoencoder: " + (e?.message || String(e)));
        } finally {
            const safeDispose = item => { try { if (item?.dispose) item.dispose(); } catch (_) {} };
            [encodedTensor, encoderModel, autoencoder, normalizedTensor, stdTensor, varianceTensor, meanTensor, inputTensor]
                .forEach(safeDispose);
        }
    }
}
