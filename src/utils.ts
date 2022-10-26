export function truncateKey(key: string): string {
  const replaced = key.replace(/[\n\r ]+/, ' ');
  if (replaced.length > 83) {
    return replaced.slice(0, 80) + '...';
  } else {
    return replaced;
  }
}
