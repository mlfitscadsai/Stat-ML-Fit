<template>
    <div class="column is-12 has-background-light upload-panel">
        <div class="upload-panel__eyebrow">
            <i class="fas fa-database" aria-hidden="true"></i>
            <span>Data Source</span>
        </div>
        <b-field class="file is-success is-fullwidth upload-drop-field" :class="{ 'has-name': !!file }">
            <b-upload accept=".csv,.txt" v-model="file" class="file-label upload-dropzone">
                <a class="button is-success is-small is-fullwidth upload-dropzone__button">
                    <b-icon pack="fas" class="file-icon upload-dropzone__icon" icon="upload"></b-icon>
                    <span class="file-label upload-dropzone__name">{{ this.settings.datasetName || "Upload dataset" }}</span>
                    <span class="upload-dropzone__hint">CSV or TXT · click to replace</span>
                </a>
            </b-upload>
        </b-field>
        <b-field class="upload-option-row">
            <span class="upload-option-row__label">Header row</span>
            <b-checkbox size="is-small" v-model="header">Header</b-checkbox>
        </b-field>
        <b-field class="upload-field" label="Separator">
            <b-select :expanded="true" v-model="separator" size="is-small">
                <option v-for="option in separatorOptions" :value="option.id" :key="option.id">
                    {{ option.label }}
                </option>
            </b-select>
        </b-field>
        <b-field class="upload-field" label="Decimal">
            <b-select :expanded="true" v-model="decimal" size="is-small">
                <option v-for="option in decimalOptions" :value="option.id" :key="option.id">
                    {{ option.label }}
                </option>
            </b-select>
        </b-field>
        <b-field class="upload-field" label="Dataset preset">
            <b-select :expanded="true" @update:modelValue="handleSampleDatasetChange" size="is-small" v-model="sampleDataset">
                <option v-for="option in samplDataOptions" :value="option.name" :key="option.id">
                    {{ option.label }}
                </option>
            </b-select>
        </b-field>
    </div>
</template>

<script>
import { ParserFactory } from '../helpers/parser/parser_factory.js'
import { getDanfo } from '@/utils/danfo_loader';
import { storeDataframeInPinia } from '@/utils/dataset_source';
import { settingStore } from '@/stores/settings'
import { BField, BCheckbox, BUpload, BSelect } from 'buefy';
const DATASET_SIZE = 10000;
export default {
    setup() {
        const settings = settingStore()
        return { settings }
    },
    name: 'UploadComponent',
    props: {
        msg: String
    },
    components: {
        BField, BCheckbox, BUpload, BSelect
    },
    data() {
        return {
            sampleDataset: 'none',
            file: null,
            separator: 2,
            header: true,
            decimal: 1,
            decimalOptions:
                [
                    {
                        id: 1,
                        label: '.',
                    }, {
                        id: 2,
                        label: ',',
                    }]
            ,
            separatorOptions:
                [
                    {
                        id: 1,
                        label: '.',
                    }, {
                        id: 2,
                        label: ',',
                    }
                    , {
                        id: 3,
                        label: 'space',
                    }]
            ,
            samplDataOptions:
                [
                    {
                        id: 0,
                        name: 'none',
                        label: 'Select toy dataset',

                    },
                    {
                        id: 1,
                        name: 'iris',
                        label: 'iris',
                    }, {
                        id: 2,
                        name: 'wine',
                        label: 'wine',

                    }
                    , {
                        id: 3,
                        name: 'diabetes',
                        label: 'diabetes',
                    }, {
                        id: 4,
                        name: 'housing',
                        label: 'California Housing',
                    }, {
                        id: 5,
                        name: 'titanic',
                        label: 'Titanic',

                    },]
            ,
        }
    },
    watch: {
        file: async function (val) {
            try {
                let dataset = await this.process_file(val, val.name.split('.')[1])
                this.initDataframe(dataset, val.name.split('.')[0])
            } catch (error) {
                this.$buefy.toast.open('Failed to parse the dataset.')
            }

        }
    },

    methods: {
        shuffle(array, seed) {
            var m = array.length, t, i;
            // While there remain elements to shuffle…
            while (m) {

                // Pick a remaining element…
                i = Math.floor(this.random(seed) * m--);

                // And swap it with the current element.
                t = array[m];
                array[m] = array[i];
                array[i] = t;
                ++seed
            }
        },
        random(seed) {
            var x = Math.sin(seed++) * 10000;
            return x - Math.floor(x);
        },
        async initDataframe(dataset, name) {
            this.settings.resetFeatures();
            this.settings.setDatasetName(name);
            const rows = Array.isArray(this.settings.rawData) ? this.settings.rawData : [];
            const columnNames =
                this.settings.datasetColumns?.length > 0
                    ? [...this.settings.datasetColumns]
                    : rows[0]
                      ? Object.keys(rows[0])
                      : Array.isArray(dataset.columns)
                        ? [...dataset.columns]
                        : [];
            const rowCount = rows.length || dataset.$data?.length || dataset.shape?.[0] || 0;
            this.settings.setDatasetShape({
                count: rowCount,
                columns: columnNames.length,
            });
            if (columnNames.length > 0) {
                this.settings.setDatasetColumns(columnNames);
            }
            let df = await dataset.sample(rowCount || dataset.$data.length, { seed: this.settings.getSeed });
            storeDataframeInPinia(this.settings, df);
            this.$emit('uploaded', true)
        },
        async process_file(file, type) {
            let options = {
                separator: this.separator,
                delimiter: this.decimal,
                header: this.header
            }
            let processdDataset = await ParserFactory.createParser(type, options).parse(file)
            if (processdDataset.length > DATASET_SIZE) {
                this.settings.setDatasizeFlag(true);
                this.shuffle(processdDataset, this.settings.getSeed)
                processdDataset = processdDataset.slice(0, DATASET_SIZE)
            } else {
                this.settings.setDatasizeFlag(false);
            }
            const danfo = await getDanfo();
            let dataFrame = new danfo.DataFrame(processdDataset);
            let rows = processdDataset;
            let columnNames = rows[0] ? Object.keys(rows[0]) : [...dataFrame.columns];
            const idIndex = columnNames.findIndex((col) => col.toLowerCase() === 'id');
            if (idIndex > -1) {
                const idCol = columnNames[idIndex];
                dataFrame.drop({ columns: idCol, inplace: true });
                rows = rows.map(({ [idCol]: _removed, ...rest }) => rest);
                columnNames = columnNames.filter((col) => col !== idCol);
            }
            this.settings.setDatasetColumns(columnNames);
            this.settings.setRawData(rows);
            this.$emit("uploaded-file", file)
            return dataFrame
        },
        /**
         * Resolve public CSV (Vite: files in /public) so fetch works with any router base path.
         * Relative fetch('iris.csv') can return index.html (SPA fallback) → HTML parsed as one column.
         */
        sampleDatasetCsvUrl(filename) {
            const base = import.meta.env.BASE_URL || '/'
            return new URL(filename, `${window.location.origin}${base}`).href
        },
        isLikelyHtmlResponse(text) {
            const t = (text || '').trimStart()
            return (
                t.startsWith('<!DOCTYPE') ||
                t.startsWith('<!doctype') ||
                t.startsWith('<html') ||
                t.startsWith('<HTML')
            )
        },
        async handleSampleDatasetChange(selectedName) {
            if (!selectedName || selectedName === 'none') {
                return
            }
            const filename = `${selectedName}.csv`
            try {
                const url = this.sampleDatasetCsvUrl(filename)
                const response = await fetch(url)
                if (!response.ok) {
                    throw new Error(`Could not load ${filename} (HTTP ${response.status}).`)
                }
                const text = await response.text()
                if (this.isLikelyHtmlResponse(text)) {
                    throw new Error(
                        'Received a web page instead of CSV. If the app is deployed under a subpath, ' +
                            'set Vite base correctly, or ensure the server serves *.csv from the app root.'
                    )
                }
                const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
                const file = new File([blob], filename, { type: 'text/csv' })
                const dataframe = await this.process_file(file, 'csv')
                this.initDataframe(dataframe, selectedName)
            } catch (error) {
                console.error('Sample dataset load failed:', error)
                this.sampleDataset = 'none'
                this.$buefy.toast.open({
                    message: error?.message || 'Failed to load sample dataset.',
                    type: 'is-danger',
                    duration: 6000,
                })
            }
        },
    }
}
</script>

<style></style>