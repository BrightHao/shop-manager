/**
 * Format a database timestamp to YYYY-MM-DD HH:mm:ss.
 *
 * MySQL timestamps come as "2026-04-24 15:01:21" (no timezone, stored as Beijing
 * time). Some APIs may return ISO format like "2026-04-24T15:01:21.000Z".
 * In both cases we display the literal date/time components without timezone conversion.
 */
export function formatDateTime(dateStr: string): string {
  if (!dateStr || typeof dateStr !== "string" || dateStr.trim() === "")
    return dateStr || "-";

  // Try to extract components directly from common formats
  // Format: "2026-04-24 15:01:21" or "2026-04-24T15:01:21.000Z"
  const match = dateStr.match(
    /(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})/,
  );
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
  }

  // Fallback: try parsing as date and extracting components
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  return dateStr;
}

/**
 * Format a database timestamp to YYYY-MM-DD (date only).
 */
export function formatDate(dateStr: string): string {
  if (!dateStr || typeof dateStr !== "string" || dateStr.trim() === "")
    return dateStr || "-";

  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  return dateStr;
}
