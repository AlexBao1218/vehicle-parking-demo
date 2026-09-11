/**
 * Logbook 导出的日期格式：YYYY-MM-DD。
 * 全项目只有此处产出该格式，Transport Team 确认后若要改格式只改这一个函数。
 */
export function formatLogbookDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}