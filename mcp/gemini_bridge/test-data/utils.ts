export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function calculateHash(input: string): string {
  // Simple hash function for testing
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}