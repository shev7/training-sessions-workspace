export const toStartsAtIso = (local: string): string =>
  new Date(local).toISOString();
