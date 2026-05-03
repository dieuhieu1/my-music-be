/**
 * Formats an asset path (like coverArtUrl) into a full absolute URL if needed.
 * If the path is already a full URL (starts with http), it's returned as is.
 * Otherwise, it prepends the backend base URL.
 */
export function getAssetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('https')) return path;

  // If path starts with a slash, remove it for consistency
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Base URL for assets (Backend is at /api/v1, so assets are usually at root)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
  const baseUrl = apiUrl.replace('/api/v1', '');

  return `${baseUrl}/${cleanPath}`;
}
