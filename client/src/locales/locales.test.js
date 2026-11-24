import { describe, it, expect } from 'vitest';
import en from './en.json';
import te from './te.json';

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('locales', () => {
  it('English and Telugu have exactly the same keys', () => {
    expect(keys(te).sort()).toEqual(keys(en).sort());
  });
});
