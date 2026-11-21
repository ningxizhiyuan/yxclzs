/**
 * 将 UTC ISO 字符串转换为本地时间（北京时间）
 * @param {string} isoString - UTC 时间，如 '2026-06-15T01:09:47.632Z'
 * @param {string} format - 'full' 年-月-日 时:分:秒, 'short' 年-月-日 时:分
 */
export const formatLocalTime = (isoString, format = 'full') => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  const Y = date.getFullYear();
  const M = (date.getMonth() + 1).toString().padStart(2, '0');
  const D = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  if (format === 'short') return `${Y}-${M}-${D} ${h}:${m}`;
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
};

/**
 * 相对时间（刚刚、X分钟前、X小时前，超过24小时显示短格式，含年）
 */
export const formatRelativeTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  if (isNaN(date.getTime())) return isoString;
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  return formatLocalTime(isoString, 'short');
};