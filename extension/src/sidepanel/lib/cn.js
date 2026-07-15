// Tiny classNames joiner (no clsx dependency — keeps the bundle lean).
// Identical implementation to landing/src/lib/utils.js's cn() — duplicated
// rather than shared because the extension and landing are separate Vite
// apps/packages with no shared-package setup; this one function is small
// enough that copying it is cheaper than the infra work of sharing it.
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}
