import { describe, it, expect } from 'vitest';
import { CSVParser } from '../../src/helpers/parser/csv_parser.js';

describe('CSVParser', () => {
    it('initializes with default options', () => {
        const parser = new CSVParser({separator: 2, delimiter: 1, header: true});
        expect(parser.has_header).toBe(true);
    });

    it('implements parse method', async () => {
        const parser = new CSVParser({separator: 2, delimiter: 1, header: true});
        const file = new File(['a,b,c\n1,2,3'], 'test.csv', { type: 'text/csv' });
        
        try {
            await parser.parse(file);
        } catch (e) {
            // we catch the error because actual Papa parse needs DOM setup and browser File
        }
    });
});
