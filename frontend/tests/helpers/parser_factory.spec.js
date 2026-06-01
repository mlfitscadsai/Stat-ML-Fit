import { describe, it, expect } from 'vitest';
import { ParserFactory } from '../../src/helpers/parser/parser_factory.js';
import { CSVParser } from '../../src/helpers/parser/csv_parser.js';
import { TXTParser } from '../../src/helpers/parser/txt_parser.js';

describe('ParserFactory', () => {
    it('creates CsvParser for csv type', () => {
        const parser = ParserFactory.createParser('csv', {separator: 2, delimiter: 1, header: true});
        expect(parser).toBeInstanceOf(CSVParser);
    });

    it('creates TxtParser for txt type', () => {
        const parser = ParserFactory.createParser('txt', {separator: 3, delimiter: 1, header: false});
        expect(parser).toBeInstanceOf(TXTParser);
    });

    it('throws error for unknown type', () => {
        expect(() => {
            ParserFactory.createParser('xml');
        }).toThrow(/Unsupported file type: xml/);
    });
});
