export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function formatSeconds(seconds: number): string {
  if (seconds >= 3600) return `${+(seconds / 3600).toFixed(1)} h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${seconds} s`;
}
