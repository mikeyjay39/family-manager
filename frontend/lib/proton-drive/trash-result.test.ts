import { describe, expect, it } from 'vitest';

import { isProtonNodeAlreadyGoneError } from './trash-result';

describe('isProtonNodeAlreadyGoneError', () => {
  it('given empty error when checking then returns false', () => {
    expect(isProtonNodeAlreadyGoneError('')).toBe(false);
    expect(isProtonNodeAlreadyGoneError('   ')).toBe(false);
  });

  it('given not-found style errors when checking then returns true', () => {
    expect(isProtonNodeAlreadyGoneError('Node not found')).toBe(true);
    expect(isProtonNodeAlreadyGoneError('The file does not exist')).toBe(true);
    expect(isProtonNodeAlreadyGoneError('HTTP 404')).toBe(true);
    expect(isProtonNodeAlreadyGoneError('No such link')).toBe(true);
  });

  it('given already-trashed style errors when checking then returns true', () => {
    expect(isProtonNodeAlreadyGoneError('Node already trashed')).toBe(true);
    expect(isProtonNodeAlreadyGoneError('File has already been trashed')).toBe(true);
  });

  it('given unrelated errors when checking then returns false', () => {
    expect(isProtonNodeAlreadyGoneError('Network timeout')).toBe(false);
    expect(isProtonNodeAlreadyGoneError('Permission denied')).toBe(false);
  });
});
