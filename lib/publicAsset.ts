/** Public files need the same build-time prefix as Next's routes on GitHub Pages. */
export function publicAsset(path: `/${string}`): string {
  const prefix = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  return `${prefix}${path}`;
}
