export const BOOKMARK_FORMAT = 'paper-signal-bookmarks';
export const MAX_BOOKMARK_BYTES = 256 * 1024;
export const MAX_BOOKMARKS = 5000;
const ID = /^[a-z0-9][a-z0-9-]{0,99}$/;

export function makeBookmarkExport(ids, date = new Date()) {
  const unique = [...new Set(ids)];
  if (unique.length > MAX_BOOKMARKS || unique.some(id=>typeof id!=='string'||!ID.test(id))) throw new Error('书签 ID 或数量无效');
  return {format:BOOKMARK_FORMAT,version:1,exportedAt:date.toISOString(),ids:unique.sort()};
}

export function parseBookmarkImport(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BOOKMARK_BYTES) throw new Error('文件过大：最多 256 KB');
  let value;
  try { value=JSON.parse(text.replace(/^\uFEFF/,'')); } catch { throw new Error('无法解析 JSON，请选择本站导出的书签文件'); }
  if (!value || Array.isArray(value) || typeof value!=='object' || value.format!==BOOKMARK_FORMAT || value.version!==1 || !Array.isArray(value.ids)) throw new Error('书签文件格式或版本不受支持');
  if (Object.keys(value).some(key=>!['format','version','exportedAt','ids'].includes(key))) throw new Error('文件包含未支持的字段；只接受论文 ID，不导入链接或脚本');
  if (typeof value.exportedAt!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.exportedAt) || !Number.isFinite(Date.parse(value.exportedAt))) throw new Error('书签文件时间标记无效');
  if (value.ids.length>MAX_BOOKMARKS) throw new Error('书签过多：最多 5000 条');
  if(value.ids.some(id=>typeof id!=='string'||!ID.test(id))) throw new Error('文件含无效论文 ID；不接受 URL、HTML 或空值');
  return new Set(value.ids);
}

export function mergeBookmarkImport(existing,incoming) {
  const merged = new Set([...existing,...incoming]);
  if(merged.size>MAX_BOOKMARKS) throw new Error('合并后超过 5000 条，请先整理书签');
  return {ids:merged,added:merged.size-existing.size,duplicates:incoming.size-(merged.size-existing.size)};
}
