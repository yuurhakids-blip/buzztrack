export const AICache = {
  get: <T>(key: string): T | null => {
    const cached = localStorage.getItem(`aicache_${key}`);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    // 5-minute TTL
    if (Date.now() - timestamp > 300000) {
      localStorage.removeItem(`aicache_${key}`);
      return null;
    }
    return data;
  },
  set: <T>(key: string, data: T) => {
    localStorage.setItem(`aicache_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
  },
  generateKey: (prefix: string, content: string) => {
    // Simple hash for content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash |= 0;
    }
    return `${prefix}_${hash}`;
  }
};
