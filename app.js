import {createHeroLineEffect} from './lib/line-block.js';
import {DEMO_NOTICE, escapeHTML as e, safeUrl, filterPapers, readRoute, routeHash, parseBookmarks, validateIndex, validateDay} from './lib/model.js';
import {updateHUD} from './lib/hud.js';
import {makeBookmarkExport,parseBookmarkImport,mergeBookmarkImport,MAX_BOOKMARK_BYTES} from './lib/bookmark-transfer.js';

const $ = id => document.getElementById(id);
const BOOKMARK_KEY = 'paper-signal-bookmarks-v1';
let state = readRoute(location.hash);
let data = null;
let bookmarks;
let storageAvailable = true;
let toastTimer;
let lastDialogPaper = '';
let dialogTrigger = null;
let heroEffect;
try { bookmarks = parseBookmarks(localStorage.getItem(BOOKMARK_KEY)); } catch { bookmarks = new Set(); storageAvailable = false; }

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}

async function getJSON(path) {
  const response = await fetch(new URL(path, import.meta.url), {cache:'no-cache'});
  if (!response.ok) throw new Error('资料请求失败');
  return response.json();
}

async function loadCollection(root, demo) {
  const index = await getJSON(`${root}/index.json`);
  if (validateIndex(index).length) throw new Error('索引格式无效');
  const days = await Promise.all(index.days.map(async entry => {
    const day = await getJSON(`${root}/${entry.file}`);
    if (validateDay(day, {demo}).length || day.date !== entry.date || day.title !== entry.title || day.papers.length !== entry.count) throw new Error('日报格式无效');
    return day;
  }));
  days.sort((a,b) => b.date.localeCompare(a.date));
  const papers = days.flatMap(day => day.papers.map(p => ({...p, date:day.date})));
  if (new Set(papers.map(p => p.id)).size !== papers.length) throw new Error('论文编号重复');
  return {days,papers};
}

async function init() {
  updateViewChrome();
  $('content').setAttribute('aria-busy','true');
  try {
    const [real,demo] = await Promise.all([loadCollection('data',false),loadCollection('data/demo',true)]);
    data = {real,demo};
    $('real-count').textContent = String(real.papers.length).padStart(2,'0');
    $('real-days').textContent = String(real.days.length).padStart(2,'0');
    render();
  } catch {
    $('hud-status').textContent = '！档案读取失败 / 可重试';
    $('content').innerHTML = `<div class="empty-state error-state"><div class="empty-art" aria-hidden="true"><span>!</span></div><h3>暂时无法读取研究档案</h3><p>请确认站点文件已完整上传，或稍后重新加载。若在本机预览，请使用本地 HTTP 服务打开。</p><button class="primary-button" data-action="retry">重新加载 ↻</button></div>`;
    $('result-count').textContent = '资料读取失败';
    $('date-list').textContent = '暂时无法读取日期';
    $('content').setAttribute('aria-busy','false');
  }
}

function collection() { return state.demo ? data.demo : data.real; }

function updateViewChrome() {
  const isFeed = state.view === 'feed';
  $('hero').hidden = !isFeed;
  $('demo-banner').hidden = !isFeed || !state.demo;
  $('page-demo-note').hidden = isFeed || !state.demo;
  document.body.classList.toggle('compact-view', !isFeed);
  heroEffect?.setVisible(isFeed);
}

function go(patch, {replace = false} = {}) {
  state = {...state, ...patch};
  updateViewChrome();
  const hash = routeHash(state);
  if (replace) history.replaceState(null,'',hash);
  else history.pushState(null,'',hash);
  if (data) {
    if (Object.keys(patch).every(key=>key==='paper')) renderDialog();
    else render();
  }
}

function toggleBookmark(id) {
  if (bookmarks.has(id)) bookmarks.delete(id); else bookmarks.add(id);
  let stored = storageAvailable;
  try { localStorage.setItem(BOOKMARK_KEY,JSON.stringify([...bookmarks])); storageAvailable = true; stored = true; }
  catch { storageAvailable = false; stored = false; }
  toast(stored ? (bookmarks.has(id) ? '已加入本机书签 · 仅当前浏览器可见' : '已移除本机书签') : '浏览器存储不可用 · 书签仅在本次页面会话有效');
  render();
}

function paperCard(p,index) {
  return `<article class="paper-card ${index === 0 ? 'featured' : ''}">
    <div class="card-top"><span class="card-number">${String(index+1).padStart(2,'0')}</span>${p.demo ? `<span class="demo-label">${DEMO_NOTICE}</span>` : '<span class="featured-label">RESEARCH SIGNAL</span>'}<time class="card-date" datetime="${p.date}">${p.date.replaceAll('-',' / ')}</time></div>
    <h3><button class="title-button" data-paper="${e(p.id)}">${e(p.title)}</button></h3>
    <p class="paper-meta">${e(p.authors.join(' · '))} <span aria-hidden="true">/</span> ${e(p.year)} <span aria-hidden="true">/</span> ${e(p.venue)}</p>
    <p class="paper-summary">${e(p.summary)}</p>
    <div class="selection-reason"><strong>入选理由</strong>${e(p.whySelected)}</div>
    <div class="card-bottom"><div class="card-tags">${p.tags.map(t => `<button class="card-tag" data-tag="${e(t)}" aria-label="筛选主题 ${e(t)}">${e(t)}</button>`).join('')}</div><div class="card-actions"><button class="bookmark-button ${bookmarks.has(p.id)?'saved':''}" data-bookmark="${e(p.id)}" aria-label="${bookmarks.has(p.id)?'移除':'添加'}本机书签：${e(p.title)}" aria-pressed="${bookmarks.has(p.id)}">${bookmarks.has(p.id)?'◆':'◇'}</button><button class="detail-button" data-paper="${e(p.id)}">阅读导读 <span aria-hidden="true">↗</span></button></div></div>
    <div class="source-note">${p.demo ? '演示条目不提供真实论文来源。' : p.sources.map(s => `<a href="${e(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.label)} ↗</a>`).join(' · ') + ' · 原始来源 / 外部网站，访问情况取决于来源站点。'}</div>
  </article>`;
}

function emptyState(kind) {
  if (kind === 'first') return `<div class="empty-state"><div class="empty-art" aria-hidden="true"><img class="empty-brand" src="./assets/favicon.svg" width="52" height="52" alt=""></div><h3>下一束信号，等待你的研究方向。</h3><p>首期精选尚未发布。确定研究主题和筛选标准后，<br>这里将呈现每天值得读的论文与中文导读。</p><button class="primary-button" data-action="demo">探索演示版 <span aria-hidden="true">↗</span></button><div class="empty-footnote">PREVIEW ONLY / 演示数据，非真实论文</div><div class="empty-steps"><span><b>01</b> 确定方向</span><span><b>02</b> 筛选论文</span><span><b>03</b> 每日归档</span></div></div>`;
  if (kind === 'bookmarks') return `<div class="empty-state no-results"><div class="empty-art" aria-hidden="true"><span>◇</span></div><h3>给值得再读的论文，留个位置。</h3><p>点击论文卡片上的 ◇，即可加入本机书签。${state.demo?'当前只显示演示模式的书签。':'当前只显示真实论文的书签。'}<br>书签仅保存在当前浏览器，不会跨设备同步。</p><button class="secondary-button" data-action="feed">返回每日精选 →</button></div>`;
  return `<div class="empty-state no-results"><div class="empty-art" aria-hidden="true"><span>⌕</span></div><h3>还没有匹配的研究信号</h3><p>试试更短的关键词，或清除日期、主题筛选。</p><button class="secondary-button" data-action="clear">清除筛选 →</button></div>`;
}

function render() {
  const active = document.activeElement;
  const focusSelector = active?.dataset?.tag ? `${active.closest('#tags')?'#tags ':''}[data-tag="${CSS.escape(active.dataset.tag)}"]` : active?.dataset?.bookmark ? `[data-bookmark="${CSS.escape(active.dataset.bookmark)}"]` : active?.dataset?.date ? `[data-date="${CSS.escape(active.dataset.date)}"]` : null;
  const {days,papers} = collection();
  updateViewChrome();
  if (state.view === 'feed') updateHUD({demo:state.demo,papers,days});
  $('bookmark-transfer').hidden = state.view !== 'bookmarks';
  const tags = [...new Set(papers.flatMap(p => p.tags))].sort((a,b) => a.localeCompare(b,'zh-CN'));
  document.querySelectorAll('nav [data-view]').forEach(b => { b.classList.toggle('active',b.dataset.view === state.view); if(b.dataset.view===state.view) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  $('bookmark-count').textContent = papers.filter(p=>bookmarks.has(p.id)).length;
  $('search').value = state.q;
  const dateValues = days.map(d=>d.date);
  $('date-select').innerHTML = '<option value="all">全部日期</option>' + (state.date !== 'all' && !dateValues.includes(state.date) ? `<option value="${state.date}">${state.date}（无档案）</option>` : '') + days.map(d=>`<option value="${d.date}">${d.date}</option>`).join('');
  $('date-select').value = state.date;
  const tagValues = state.tag !== 'all' && !tags.includes(state.tag) ? [...tags,state.tag] : tags;
  $('tags').innerHTML = ['all',...tagValues].map(t=>`<button class="tag ${state.tag===t?'active':''}" data-tag="${e(t)}" aria-pressed="${state.tag===t}">${t==='all'?'全部':e(t)}</button>`).join('');
  $('date-list').innerHTML = days.length ? days.slice(0,4).map(d=>`<button class="date-item ${state.date===d.date?'active':''}" data-date="${d.date}" aria-label="查看 ${d.date}，${d.papers.length} 篇${state.demo?'演示条目':'论文'}"><span class="date-number">${d.date.slice(8)}</span><span class="date-meta">${d.date.slice(0,7).replace('-',' / ')}<small>${state.demo?'演示归档':'研究档案'}</small></span><span class="date-count">${String(d.papers.length).padStart(2,'0')} ↗</span></button>`).join('') : '<div class="archive-placeholder">NO ENTRIES YET<span>首期发布后，按日期自动归档。</span></div>';
  const filtered = filterPapers(papers,{...state,bookmarks:state.view==='bookmarks'?bookmarks:null});
  const isFiltered = state.q || state.tag!=='all' || state.date!=='all';
  $('view-title').childNodes[0].textContent = state.view === 'archive' ? '日期归档' : state.view === 'bookmarks' ? '本机书签' : '每日精选';
  $('edition-label').textContent = state.demo ? '演示档案' : !days.length ? '等待首期' : state.date === 'all' ? '全部日期' : state.date;
  $('edition-status').textContent = state.demo ? 'DEMO / NOT REAL PAPERS' : papers.length ? 'CURATED & ARCHIVED' : 'AWAITING SIGNAL';
  $('filter-panel').hidden = state.view==='archive';
  $('clear-filters').hidden = !isFiltered || state.view==='archive';
  $('result-count').textContent = state.view==='archive' ? `${days.length} 个${state.demo?'演示':'真实'}日期档案` : papers.length ? `${filtered.length} / ${papers.length} 篇${state.demo?'演示条目 · 非真实论文':'论文'}${state.view==='bookmarks'?' · 仅本机收藏':''}` : '真实论文 0 篇 · 筛选规则待设定';
  if (state.view==='archive' && days.length) $('content').innerHTML = `<div class="archive-grid">${days.map(d=>`<button class="archive-card" data-date="${d.date}"><p class="eyebrow">${state.demo?'DEMO ARCHIVE':'DAILY ARCHIVE'}</p><strong>${d.date.replaceAll('-',' / ')}</strong><p>${e(d.title)}</p><span>${d.papers.length} 篇${state.demo?'演示条目':'精选论文'} <span aria-hidden="true">↗</span></span></button>`).join('')}</div>`;
  else if (!papers.length) $('content').innerHTML = emptyState('first');
  else if (!filtered.length) $('content').innerHTML = emptyState(state.view==='bookmarks' && !isFiltered ? 'bookmarks':'filtered');
  else $('content').innerHTML = `<div class="paper-list">${filtered.map(paperCard).join('')}</div>`;
  $('content').setAttribute('aria-busy','false');
  renderDialog();
  if (focusSelector && !active.isConnected && !$('detail-dialog').open) document.querySelector(focusSelector)?.focus({preventScroll:true});
}

function renderDialog() {
  const dialog = $('detail-dialog');
  if (!state.paper) {
    if (dialog.open) dialog.close();
    lastDialogPaper = '';
    return;
  }
  const p = collection().papers.find(p => p.id===state.paper);
  if (!p) {
    if (dialog.open) dialog.close();
    state.paper = ''; history.replaceState(null,'',routeHash(state));
    toast('未找到这篇论文，已返回当前档案。'); return;
  }
  if (lastDialogPaper===p.id && dialog.open) {
    const b = $('dialog-content').querySelector('[data-bookmark]');
    if (b) { b.textContent = bookmarks.has(p.id)?'◆ 已加入本机书签':'◇ 加入本机书签'; b.setAttribute('aria-pressed',bookmarks.has(p.id)); }
    return;
  }
  lastDialogPaper = p.id;
  $('dialog-kicker').textContent = `PAPER BRIEF / ${p.date}`;
  $('dialog-content').innerHTML = `${p.demo?`<p class="dialog-warning">${DEMO_NOTICE}。本页只展示排版与交互，不代表任何研究成果。</p>`:''}<h2 id="dialog-title">${e(p.title)}</h2>${p.titleEn?`<p>${e(p.titleEn)}</p>`:''}<div class="dialog-meta">${e(p.authors.join(' · '))}<br>${e(p.venue)} / ${p.year} / 收录于 ${p.date}</div><h3>中文导读</h3><p>${e(p.summary)}</p><h3>为什么入选</h3><p>${e(p.whySelected)}</p><h3>研究主题</h3><div class="card-tags">${p.tags.map(t=>`<span class="card-tag">${e(t)}</span>`).join('')}</div><h3>原始来源</h3>${p.sources.length?`<div class="source-links">${p.sources.map(s=>`<a href="${e(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.label)} ↗</a>`).join('')}</div><p class="source-note">链接将打开外部网站；可用性取决于原始来源。导读不能替代阅读全文。</p>`:'<p>演示条目不提供来源链接，避免与真实论文混淆。</p>'}<button class="secondary-button dialog-bookmark" data-bookmark="${e(p.id)}" aria-pressed="${bookmarks.has(p.id)}">${bookmarks.has(p.id)?'◆ 已加入本机书签':'◇ 加入本机书签'}</button>`;
  if (!dialog.open) dialog.showModal();
}

function closeDialog() {
  const paperId = state.paper;
  if (state.paper) go({paper:''});
  else $('detail-dialog').close();
  if (dialogTrigger?.isConnected) dialogTrigger.focus();
  else if (paperId) document.querySelector(`[data-paper="${CSS.escape(paperId)}"]`)?.focus({preventScroll:true});
}

document.addEventListener('click', event => {
  const b = event.target.closest('button');
  if (!b) return;
  if (b.dataset.view) go({view:b.dataset.view,q:'',tag:'all',date:'all',paper:''});
  else if (b.dataset.paper) { dialogTrigger = b; go({paper:b.dataset.paper}); }
  else if (b.dataset.bookmark) toggleBookmark(b.dataset.bookmark);
  else if (b.dataset.tag) go({tag:b.dataset.tag,view:'feed',paper:''});
  else if (b.dataset.date) go({date:b.dataset.date,view:'feed',q:'',tag:'all',paper:''});
  else if (b.dataset.action === 'demo') go({demo:true,view:'feed',date:'all',tag:'all',q:'',paper:''});
  else if (b.dataset.action === 'clear') go({q:'',tag:'all',date:'all'});
  else if (b.dataset.action === 'feed') go({view:'feed',q:'',tag:'all',date:'all'});
  else if (b.dataset.action === 'retry') init();
});
$('search').addEventListener('input', event => go({q:event.target.value},{replace:true}));
$('date-select').addEventListener('change', event => go({date:event.target.value}));
$('clear-filters').addEventListener('click',()=>go({q:'',tag:'all',date:'all'}));
$('export-bookmarks').addEventListener('click',()=>{
  const payload=makeBookmarkExport(bookmarks);
  const serialized=JSON.stringify(payload,null,2)+'\n';
  $('export-json').value=serialized;
  $('export-preview').hidden=false;
  const blob=new Blob([serialized],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a'); anchor.href=url; anchor.download=`paper-signal-bookmarks-${payload.exportedAt.slice(0,10)}.json`; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  $('transfer-status').classList.remove('error');
  $('transfer-status').textContent=`已生成 ${bookmarks.size} 条本机书签的 JSON 文件。请保存在“文件”中，在另一台设备导入；不会自动同步或上传。`;
});
function applyLocalImport(text) {
    const incoming=parseBookmarkImport(text);
    const result=mergeBookmarkImport(bookmarks,incoming);
    // Persist before changing the in-memory set. Failed imports preserve all existing bookmarks.
    localStorage.setItem(BOOKMARK_KEY,JSON.stringify([...result.ids]));
    bookmarks=result.ids; storageAvailable=true;
    const knownIds=new Set(data ? [...data.real.papers,...data.demo.papers].map(p=>p.id) : []);
    const unknown=[...incoming].filter(id=>!knownIds.has(id)).length;
    $('transfer-status').classList.remove('error');
    $('transfer-status').textContent=`导入成功：新增 ${result.added} 条，已有 ${result.duplicates} 条，总计 ${bookmarks.size} 条。${unknown?`${unknown} 条 ID 暂未在本站收录，已保留。`:''}原有书签已保留；没有上传或公开。`;
    if(data)render();
}
function reportImportError(error) {
    $('transfer-status').classList.add('error');
    $('transfer-status').textContent=`导入失败：${error instanceof Error && !/quota|storage|access/i.test(error.message)?error.message:'浏览器无法保存，请检查存储权限或空间'}。原有书签未改变。`;
}
$('import-bookmarks').addEventListener('change',async event=>{
  const file=event.target.files?.[0]; if(!file)return;
  try{
    if(file.size>MAX_BOOKMARK_BYTES)throw new Error('文件过大：最多 256 KB');
    applyLocalImport(await file.text());
  }catch(error){reportImportError(error);
  }finally{event.target.value='';}
});
$('import-pasted').addEventListener('click',()=>{
  try{applyLocalImport($('import-json').value);}catch(error){reportImportError(error);}
});
$('exit-demo').addEventListener('click',()=>go({demo:false,view:'feed',date:'all',tag:'all',q:'',paper:''}));
$('exit-page-demo').addEventListener('click',()=>go({demo:false,date:'all',tag:'all',q:'',paper:''}));
$('close-dialog').addEventListener('click',closeDialog);
$('detail-dialog').addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
$('detail-dialog').addEventListener('click',event=>{if(event.target===$('detail-dialog')){const r=$('detail-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
$('about-button').addEventListener('click',()=>{
  if(state.paper) go({paper:''});
  dialogTrigger = $('about-button'); lastDialogPaper = '';
  $('dialog-kicker').textContent = 'ABOUT / ZERO FIELD';
  $('dialog-content').innerHTML = '<h2 id="dialog-title">让好问题，遇见好论文。</h2><p>零域 / ZERO FIELD 是一个纯前端学术阅读站。论文链接、中文导读和入选理由以日期 JSON 文件保存在同一仓库，发布后即可浏览和检索。</p><ol class="about-steps"><li>筛选规则尚未设定，当前真实收录为零。演示模式只用于预览界面，条目不对应真实论文。</li><li>网站不会自动搜索论文。未来的搜集与筛选任务需另行设定，并把审核后的资料提交到仓库。</li><li>书签保存在当前浏览器。没有登录、云端数据库、追踪器或跨设备同步；清除浏览器数据后书签会消失。</li><li>页面资源与资料随站点一起托管，不依赖第三方字体或论文 API。原文链接指向外部站点，其访问情况可能不同。</li></ol>';
  $('detail-dialog').showModal();
});
function syncRoute(){if(location.hash==='#main')return;state=readRoute(location.hash);updateViewChrome();if(data)render();}
window.addEventListener('popstate',syncRoute);
window.addEventListener('hashchange',syncRoute);
window.addEventListener('storage',event=>{if(event.key===BOOKMARK_KEY){bookmarks=parseBookmarks(event.newValue);if(data)render();}});
document.addEventListener('keydown',event=>{if(event.key==='/' && !event.ctrlKey && !event.metaKey && !event.altKey && !$('detail-dialog').open && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !$('filter-panel').hidden){event.preventDefault();$('search').focus();}});
heroEffect = createHeroLineEffect();
init();
