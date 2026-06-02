/**
 * Single static entry for Danfo — ensures Vite always bundles into data-danfo-*.js
 * (dynamic import of node_modules paths can leak as bare specifiers in production).
 */
export {
    DataFrame,
    Series,
    concat,
    merge,
    getDummies,
    LabelEncoder,
    OneHotEncoder,
    toCSV,
    toJSON,
    readCSV,
    tensorflow,
} from 'danfojs/dist/danfojs-browser/src/index.js';

import * as danfoNamespace from 'danfojs/dist/danfojs-browser/src/index.js';
export default danfoNamespace;
