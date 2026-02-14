const { 
  fetchPage, 
  calculateChecksum 
} = require('../src/fetcher');

describe('fetcher', () => {
  test('calculateChecksum produces consistent hash', () => {
    const text = 'test content';
    const hash1 = calculateChecksum(text);
    const hash2 = calculateChecksum(text);
    
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(32); // MD5 hex length
  });

  test('fetchPage returns null for invalid URL', async () => {
    const result = await fetchPage('https://invalid-url-that-does-not-exist.com');
    expect(result).toBeNull();
  });
});
