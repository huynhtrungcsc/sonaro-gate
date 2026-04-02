/**
 * Shared formatting utilities for Sonaro Gate
 * Consolidates duplicate formatBytes/formatUptime/formatSize/formatDuration
 */

/**
 * Format bytes to human-readable string (e.g., 1.5 GB)
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '0 B';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return bytes + ' B';
}

/**
 * Format file size with adaptive precision (e.g., 2.4 MB, 512 KB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format uptime seconds to human-readable (e.g., "30 days 2 hours 15 minutes")
 */
export function formatUptime(seconds: number): string {
  if (!seconds || seconds === 0) return '--';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days} days ${hours} hours ${minutes} minutes`;
}

/**
 * Format uptime seconds to short form (e.g., "30d 2h 15m")
 */
export function formatUptimeShort(seconds: number): string {
  if (!seconds || seconds === 0) return '--';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Format duration between two timestamps
 */
export function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '00:00:00';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const diff = Math.floor((e - s) / 1000);
  const h = Math.floor(diff / 3600).toString().padStart(2, '0');
  const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
  const sec = (diff % 60).toString().padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

/**
 * Format network speed from bytes/sec
 */
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1073741824) return (bytesPerSec / 1073741824).toFixed(1) + ' Gbps';
  if (bytesPerSec >= 1048576) return (bytesPerSec / 1048576).toFixed(1) + ' Mbps';
  if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(1) + ' Kbps';
  return bytesPerSec + ' bps';
}
