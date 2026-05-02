const ipMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string, max: number = 10, window: number = 60000): boolean {
  const now = Date.now();
  const entry = ipMap.get(ip);

  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + window });
    return true;
  }

  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

export function cleanupRateLimit(): void {
  const now = Date.now();
  for (const [ip, data] of ipMap.entries()) {
    if (now > data.resetAt) {
      ipMap.delete(ip);
    }
  }
}
