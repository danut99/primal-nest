/** Fingerprint the complete recipe so edited dinosaurs never reuse stale artwork. */
export function thumbnailRecipeKey(recipe: unknown): string {
  const text = JSON.stringify(recipe);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
