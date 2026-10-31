import {matchesTopic} from './topics.js';
import {validateDigestDay} from './digest.js';
export {PROFILES,STATUS_LABELS,DEPTH_LABELS,DIFFICULTY_LABELS,READING_LABELS,profileCounts,mergeOccurrences} from './digest.js';
export const DEMO_NOTICE = '演示数据，非真实论文';

export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function safeUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return !url.username && !url.password && ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}

export function filterPapers(papers, {q = '', tag = 'all', date = 'all', bookmarks = null, category = 'all', readStatus = 'all', read = new Set()} = {}) {
  const query = q.trim().toLocaleLowerCase();
  return papers.map(p=>date!=='all'&&p.appearances ? (p.appearances.find(x=>x.date===date)||p) : p).filter(p => (date === 'all' || p.date === date)
    && (category==='all'||p.profiles?.includes(category))
    && (readStatus==='all'||(readStatus==='read'?read.has(p.id):!read.has(p.id)))
    && matchesTopic(p,tag,category)
    && (!bookmarks || bookmarks.has(p.id))
    && (!query || [p.title, p.titleEn, ...p.authors, p.venue, p.summary, p.whySelected, ...p.tags].join(' ').toLocaleLowerCase().includes(query)));
}

export function readRoute(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  return {sourceType:['conference','journal','lab'].includes(p.get('source'))?p.get('source'):'conference',category:['xun','li','lv'].includes(p.get('category'))?p.get('category'):'all',readStatus:['read','unread'].includes(p.get('read'))?p.get('read'):'all',demo:p.get('demo') === '1', view:['feed','archive','bookmarks','sources'].includes(p.get('view')) ? p.get('view') : 'feed', date:isDate(p.get('date')) ? p.get('date') : 'all', q:(p.get('q') || '').slice(0,200), tag:(p.get('tag') || 'all').slice(0,60), paper:(p.get('paper') || '').slice(0,100)};
}

export function routeHash(state) {
  const p = new URLSearchParams();
  p.set('view', state.view);
  if(state.sourceType&&state.sourceType!=='conference')p.set('source',state.sourceType);
  if(state.category && state.category!=='all')p.set('category',state.category);
  if(state.readStatus && state.readStatus!=='all')p.set('read',state.readStatus);
  if (state.demo) p.set('demo', '1');
  if (state.date) p.set('date', state.date);
  if (state.q) p.set('q', state.q);
  if (state.tag !== 'all') p.set('tag', state.tag);
  if (state.paper) p.set('paper', state.paper);
  return `#${p}`;
}

export function parseBookmarks(raw) {
  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(id)).slice(0,5000) : []);
  } catch { return new Set(); }
}

export function validateIndex(index) {
  const errors = [];
  if (!index || index.version !== 1 || !Array.isArray(index.days)) return ['索引需要 version: 1 和 days 数组'];
  const dates = new Set();
  for (const day of index.days) {
    if (!day || !isDate(day.date)) { errors.push('索引日期无效'); continue; }
    if (dates.has(day.date)) errors.push(`重复日期 ${day.date}`);
    dates.add(day.date);
    if (day.file !== `days/${day.date}.json`) errors.push(`${day.date}: 文件必须为 days/YYYY-MM-DD.json`);
    if (!Number.isInteger(day.count) || day.count < 0) errors.push(`${day.date}: count 必须为非负整数`);
    if (typeof day.title !== 'string' || !day.title.trim() || day.title.length > 120) errors.push(`${day.date}: title 无效`);
  }
  return errors;
}

export function validateDay(day, {demo = false} = {}) {
  if(day?.version===2)return demo?['演示目录不接受真实日报v2']:validateDigestDay(day,{isDate,safeUrl});
  const errors = [];
  if (!day || day.version !== 1 || !isDate(day.date) || !Array.isArray(day.papers)) return ['日报需要 version: 1、有效 date 和 papers 数组'];
  if (day.demo !== demo) errors.push('日报 demo 标记与目录不匹配');
  if (typeof day.title !== 'string' || !day.title.trim() || day.title.length > 120) errors.push('日报 title 无效');
  const ids = new Set();
  for (const p of day.papers) {
    const label = p?.id || '(无 id)';
    if (!p || typeof p.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(p.id)) { errors.push('论文 id 需为小写字母、数字和短横线'); continue; }
    if (ids.has(p.id)) errors.push(`重复 id ${p.id}`);
    ids.add(p.id);
    for (const field of ['title','venue','summary','whySelected']) if (typeof p[field] !== 'string' || !p[field].trim() || p[field].length > 10000) errors.push(`${label}: ${field} 必须为非空文本且不超过 10000 字符`);
    if (p.titleEn !== undefined && (typeof p.titleEn !== 'string' || p.titleEn.length > 2000)) errors.push(`${label}: titleEn 无效`);
    for (const field of ['authors','tags']) if (!Array.isArray(p[field]) || !p[field].length || p[field].length > 50 || p[field].some(v => typeof v !== 'string' || !v.trim() || v.length > 200)) errors.push(`${label}: ${field} 必须为非空文本数组`);
    if (!Number.isInteger(p.year) || p.year < 1800 || p.year > 2200) errors.push(`${label}: year 必须是 1800–2200 的整数`);
    if (p.demo !== demo) errors.push(`${label}: demo 标记不匹配`);
    if (demo && p.notice !== DEMO_NOTICE) errors.push(`${label}: 演示论文必须标注 ${DEMO_NOTICE}`);
    if (!demo && /^(demo-|example-)/.test(p.id)) errors.push(`${label}: 真实目录不允许演示 id`);
    if (!Array.isArray(p.sources) || (!demo && !p.sources.length)) errors.push(`${label}: 真实论文至少需要一个来源`);
    else for (const source of p.sources) if (!source || typeof source.label !== 'string' || !source.label.trim() || !safeUrl(source.url)) errors.push(`${label}: 来源需含 label 和无凭据 HTTP(S) URL`);
  }
  return errors;
}
