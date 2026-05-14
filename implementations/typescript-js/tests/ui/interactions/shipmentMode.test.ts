// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { shipmentMode } from '../../../src/ui/interactions/shipmentMode.js';

describe('shipmentMode', () => {
  it('exports an object with setSub method and a getSub returning a state string', () => {
    expect(typeof shipmentMode.setSub).toBe('function');
    const sub = shipmentMode.getSub();
    expect(typeof sub).toBe('string');
  });

  it('getSub returns a value from the expected set', () => {
    expect(['none', 'stockpile', 'horse-source', 'horse-dest',
      'weapon-source', 'weapon-dest', 'boat-source', 'boat-dest']).toContain(shipmentMode.getSub());
  });

  it('setSub transitions sub state correctly', () => {
    shipmentMode.setSub('horse');
    expect(shipmentMode.getSub()).toBe('horse-source');

    shipmentMode.setSub('weapon');
    expect(shipmentMode.getSub()).toBe('weapon-source');

    shipmentMode.setSub('boat');
    expect(shipmentMode.getSub()).toBe('boat-source');

    shipmentMode.setSub('stockpile');
    expect(shipmentMode.getSub()).toBe('stockpile');

    shipmentMode.setSub('none');
    expect(shipmentMode.getSub()).toBe('none');
  });
});
