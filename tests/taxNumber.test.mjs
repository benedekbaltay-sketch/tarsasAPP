import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatTaxNumber, cleanTaxNumber } from '../src/utils/taxNumber.js';

describe('formatTaxNumber & cleanTaxNumber', () => {
  it('handles empty and null values safely', () => {
    assert.equal(formatTaxNumber(''), '');
    assert.equal(formatTaxNumber(null), '');
    assert.equal(formatTaxNumber(undefined), '');
    assert.equal(cleanTaxNumber(''), '');
    assert.equal(cleanTaxNumber(null), '');
  });

  it('formats partial input while typing (1-8 digits)', () => {
    assert.equal(formatTaxNumber('1'), '1');
    assert.equal(formatTaxNumber('12345'), '12345');
    assert.equal(formatTaxNumber('12345678'), '12345678');
  });

  it('formats 9th digit with first hyphen', () => {
    assert.equal(formatTaxNumber('123456781'), '12345678-1');
  });

  it('formats 10th and 11th digits with second hyphen', () => {
    assert.equal(formatTaxNumber('1234567814'), '12345678-1-4');
    assert.equal(formatTaxNumber('12345678142'), '12345678-1-42');
  });

  it('clamps to 11 digits maximum', () => {
    assert.equal(formatTaxNumber('1234567814299999'), '12345678-1-42');
  });

  it('handles input already containing hyphens, spaces, or letters', () => {
    assert.equal(formatTaxNumber('12345678-1-42'), '12345678-1-42');
    assert.equal(formatTaxNumber('1234 5678 1 42'), '12345678-1-42');
    assert.equal(formatTaxNumber('HU12345678142'), '12345678-1-42');
  });

  it('cleanTaxNumber returns digits only', () => {
    assert.equal(cleanTaxNumber('12345678-1-42'), '12345678142');
    assert.equal(cleanTaxNumber('12345678142'), '12345678142');
  });
});
