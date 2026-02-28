/**
 * cache.js - Simple TTL cache implementation
 */

class TTLCache {
  constructor(options = {}) {
    this.ttl = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize || 100;
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    
    return item.value;
  }

  set(key, value) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = { TTLCache };
