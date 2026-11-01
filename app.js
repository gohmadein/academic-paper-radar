import {sideArtLayout} from './lib/side-art.js';
import {createNotesStore,MAX_NOTE_LENGTH,MAX_NOTES_BYTES} from './lib/paper-notes.js';
import {noteButton} from './lib/notes-view.js';
import {researchMapModel,researchMapHTML,positionMapMarkers} from './lib/research-map.js';
import {profileIcon} from './lib/profile-icons.js';
import {sourceDirectory,sourceViewPatch,SOURCE_NAV} from './lib/source-directory.js';
import {availableTopics,topicLabel,topicForProfile} from './lib/topics.js';
import {institutionGallery,scrollInstitutions,institutionKeydown} from './lib/institutions.js';
import {publicPaperURL,sharePaper} from './lib/paper-share.js';
import {handleMediaError} from './lib/paper-media.js';
import {categoryClass,categoryRail,digestBadges,digestRecommendations,digestDetails,issueReport,editorialCard,bilingualDetail} from './lib/digest-view.js';
import {DEMO_NOTICE, escapeHTML as e, safeUrl, filterPapers, readRoute, routeHash, parseBookmarks, validateIndex, validateDay,PROFILES,mergeOccurrences} from './lib/model.js';
import {updateHUD} from './lib/hud.js';
import {makeBookmarkExport,parseBookmarkImport,mergeBookmarkImport,MAX_BOOKMARK_BYTES} from './lib/bookmark-transfer.js';

const $ = id => document.getElementById(id);
const BOOKMARK_KEY = 'paper-signal-bookmarks-v1';
const notes = createNotesStore({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)});
let noteId='', noteTrigger=null, noteTimer, resumeDetail=false;
const READ_KEY = 'paper-signal-read-v1';
const RAIL_KEY = 'zero-field-rail-collapsed-v1';
const PROFILE_MOTTOS = {xun:'我会成为机器人发展史上不可跨过的人物吗',li:'As Always',lv:'年入百万，迎娶🇨🇦姐姐，我只是想给她一个中国户口'};
let railCollapsed = false;
try { railCollapsed = localStorage.getItem(RAIL_KEY) === 'true'; } catch { /* Layout still works without storage. */ }
function updateSideArt() {
  const main=$('main'),rail=document.querySelector('.navigation-rail');
  if(!main?.getBoundingClientRect || !rail?.getBoundingClientRect)return;
  const bounds=main.getBoundingClientRect();
  const layout=sideArtLayout({viewportWidth:document.documentElement.clientWidth,mainLeft:bounds.left,mainRight:bounds.right,railRight:rail.getBoundingClientRect().right});
  main.classList.toggle('has-side-art',layout.visible);
  main.style.setProperty('--art-left-width',`${layout.leftWidth}px`);
  main.style.setProperty('--art-right-width',`${layout.rightWidth}px`);
}
function updateRail() {
  document.body.classList.toggle('rail-collapsed', railCollapsed);
  const toggle = $('rail-toggle');
  toggle.setAttribute('aria-expanded', String(!railCollapsed));
  toggle.setAttribute('aria-label', railCollapsed ? '展开侧栏' : '收起侧栏');
  toggle.title = railCollapsed ? '展开侧栏' : '收起侧栏';
  updateSideArt();
}
updateRail();
window.addEventListener('resize',updateSideArt);
if(typeof ResizeObserver !== 'undefined'){
  const sideArtObserver=new ResizeObserver(updateSideArt);
  sideArtObserver.observe($('main'));
  sideArtObserver.observe(document.querySelector('.navigation-rail'));
}
$('rail-toggle').addEventListener('click', () => {
  railCollapsed = !railCollapsed;
  updateRail();
  try { localStorage.setItem(RAIL_KEY, String(railCollapsed)); } catch { /* Keep the session choice. */ }
});

let reads;
try{reads=parseBookmarks(localStorage.getItem(READ_KEY));}catch{reads=new Set();}
let state = readRoute(location.hash);
let data = null;
let watchlists = null;
let mapMode = 'all';
let mapRegion = '';
let mapProfile = '';
let mapPaper = '';
let lastMapMarkup = '';
let bookmarks;
let storageAvailable = true;
let toastTimer;
let lastDialogPaper = '';
let dialogTrigger = null;
const expandedGuides = new Set();
let shareRequest = 0;
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
  return {days,papers:mergeOccurrences(days)};
}

async function init() {
  updateViewChrome();
  $('content').setAttribute('aria-busy','true');
  try {
    const [real,demo,institutions] = await Promise.all([loadCollection('data',false),loadCollection('data/demo',true),getJSON('data/institutions.json')]);
    const geography = await getJSON('data/paper-geography.json').catch(()=>null);
    data = {real,demo,institutions,geography};
    if(state.view==='feed'&&!state.demo&&!new URLSearchParams(location.hash.slice(1)).has('date')&&real.days.length){state.date=real.days[0].date;history.replaceState(null,'',routeHash(state));}
    $('real-count').textContent = String(real.papers.length).padStart(2,'0');
    $('real-days').textContent = String(real.days.length).padStart(2,'0');
    try {
      const [profiles,registry] = await Promise.all([getJSON('config/profile-watchlists.json'),getJSON('config/source-registry.json')]);
      watchlists = {profiles,registry};
    } catch { watchlists = null; }
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
  document.body.classList.toggle('xun-side-art', isFeed && !state.demo && state.category === 'xun');
  const motto=isFeed&&!state.demo ? PROFILE_MOTTOS[state.category]||'' : '';
  $('profile-motto').textContent=motto;
  $('profile-motto').hidden=!motto;
  $('profile-motto').setAttribute('data-profile',motto?state.category:'');
  $('profile-motto').setAttribute('lang',state.category==='li'?'en':'zh-CN');
  $('research-map').hidden = !isFeed || state.demo;
  $('reading-intro').classList.toggle('with-map',isFeed&&!state.demo);
  $('hero').hidden = !isFeed;
  $('demo-banner').hidden = !isFeed || !state.demo;
  $('page-demo-note').hidden = isFeed || !state.demo || state.view==='sources';
  document.body.classList.toggle('compact-view', !isFeed);
}

function go(patch, {replace = false} = {}) {
  closeNotes(false);
  shareRequest++;
  if ($('share-dialog').open) $('share-dialog').close();
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
  toast(stored ? (bookmarks.has(id) ? '已加入本机书签' : '已移除本机书签') : '浏览器存储不可用 · 书签仅在本次页面会话有效');
  render();
}

function paperCard(p,index) {
  if(p.profiles)return editorialCard(p,index,{category:state.category,saved:bookmarks.has(p.id),read:reads.has(p.id),expanded:expandedGuides.has(p.id),hasNote:notes.has(p.id)});
  return `<article class="paper-card ${index === 0 ? 'featured' : ''} ${categoryClass(p,state.category)}">
    ${categoryRail(p)}<div class="card-top"><span class="card-number">${String(index+1).padStart(2,'0')}</span>${p.demo ? `<span class="demo-label">${DEMO_NOTICE}</span>` : '<span class="featured-label">RESEARCH SIGNAL</span>'}<time class="card-date" datetime="${p.date}">${p.date.replaceAll('-',' / ')}</time></div>
    ${digestBadges(p)}<h3><button class="title-button" data-paper="${e(p.id)}">${e(p.title)}</button></h3>
    ${p.profiles?`<p class="paper-title-en">${e(p.titleEn)}</p>`:''}<p class="paper-meta">${e(p.authors.join(' · '))} <span aria-hidden="true">/</span> ${e(p.year)} <span aria-hidden="true">/</span> ${e(p.venue)}</p>
    <p class="paper-summary">${e(p.summary)}</p>
    ${p.profiles?'':`<div class="selection-reason"><strong>入选理由</strong>${e(p.whySelected)}</div>`}
    ${digestRecommendations(p,state.category)}<div class="card-bottom"><div class="card-tags">${p.tags.map(t => `<button class="card-tag" data-tag="${e(t)}" aria-label="筛选主题 ${e(t)}">${e(t)}</button>`).join('')}</div><div class="card-actions">${noteButton(p,notes.has(p.id))}<button class="read-button ${reads.has(p.id)?'is-read':''}" data-read="${e(p.id)}" aria-pressed="${reads.has(p.id)}">${reads.has(p.id)?'已读':'标为已读'}</button><button class="bookmark-button ${bookmarks.has(p.id)?'saved':''}" data-bookmark="${e(p.id)}" aria-label="${bookmarks.has(p.id)?'移除':'添加'}本机书签：${e(p.title)}" aria-pressed="${bookmarks.has(p.id)}">${bookmarks.has(p.id)?'◆':'◇'}</button><button class="detail-button" data-paper="${e(p.id)}">阅读导读 <span aria-hidden="true">↗</span></button></div></div>
    <div class="source-note">${p.demo ? '演示条目不提供真实论文来源。' : p.sources.map(s => `<a href="${e(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.label)} ↗</a>`).join(' · ')}</div>
  </article>`;
}

function emptyState(kind) {
  if (kind === 'first') return `<div class="empty-state"><div class="empty-art" aria-hidden="true"><img class="empty-brand" src="./assets/favicon.svg" width="52" height="52" alt=""></div><h3>暂无论文</h3><p>首期尚未发布。</p><button class="primary-button" data-action="demo">探索演示版 <span aria-hidden="true">↗</span></button><div class="empty-footnote">PREVIEW ONLY / 演示数据，非真实论文</div></div>`;
  if (kind === 'bookmarks') return `<div class="empty-state no-results"><div class="empty-art" aria-hidden="true"><span>◇</span></div><h3>暂无书签</h3><p>点击论文卡片上的 ◇ 收藏。${state.demo?'当前只显示演示模式的书签。':'当前只显示真实论文的书签。'}</p><button class="secondary-button" data-action="feed">返回每日精选 →</button></div>`;
  return `<div class="empty-state no-results"><div class="empty-art" aria-hidden="true"><span>⌕</span></div><h3>没有匹配的论文</h3><p>调整关键词或清除筛选。</p><button class="secondary-button" data-action="clear">清除筛选 →</button></div>`;
}

function renderMap() {
  if(!data)return;
  if(mapProfile!==state.category){mapRegion='';mapProfile=state.category;}
  const model=researchMapModel(data.real.papers,data.geography,{profile:state.category,mode:mapMode});
  if(!model.groups.some(g=>g.id===mapRegion))mapRegion='';
  const markup=researchMapHTML(model,mapRegion);
  if(markup===lastMapMarkup)return;
  lastMapMarkup=markup;
  const expanded=$('map-regions')?.open;
  $('research-map').innerHTML=markup;
  positionMapMarkers(document);
  if(expanded&&$('map-regions'))$('map-regions').open=true;
}

function render() {
  const active = document.activeElement;
  const focusSelector = active?.dataset?.read ? `[data-read="${CSS.escape(active.dataset.read)}"]` : active?.dataset?.guideToggle ? `[data-guide-toggle="${CSS.escape(active.dataset.guideToggle)}"]` : active?.dataset?.sourceProfile ? `[data-source-profile="${CSS.escape(active.dataset.sourceProfile)}"][data-source-type="${CSS.escape(active.dataset.sourceType||'conference')}"]` : active?.dataset?.category ? `[data-category="${CSS.escape(active.dataset.category)}"]` : active?.dataset?.tag ? `${active.closest('#tags')?'#tags ':''}[data-tag="${CSS.escape(active.dataset.tag)}"]` : active?.dataset?.bookmark ? `[data-bookmark="${CSS.escape(active.dataset.bookmark)}"]` : active?.dataset?.date ? `[data-date="${CSS.escape(active.dataset.date)}"]` : null;
  const {days,papers} = collection();
  $('category-tabs').innerHTML=['all',...Object.keys(PROFILES)].map(k=>`<div class="profile-nav-item"><button class="profile-link ${k!=='all'?'profile-'+k:''} ${state.category===k&&state.view!=='sources'?'active':''}" data-category="${k}" aria-label="${k==='all'?'全部方向':PROFILES[k].label+'的推送'}" aria-pressed="${state.category===k&&state.view!=='sources'}" title="${k==='all'?'浏览全部研究方向':e(PROFILES[k].label+' · '+PROFILES[k].description)}"><span class="profile-symbol" aria-hidden="true">${k==='all'?'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>':profileIcon(k)}</span><span class="profile-link-copy"><strong>${k==='all'?'全部方向':PROFILES[k].label+'的推送'}</strong><small>${k==='all'?'发现全部研究信号':k==='xun'?'机器人研究':k==='li'?'知识图谱与理论':'机器人学习入门'}</small></span><span class="profile-selected" aria-hidden="true">●</span></button>${k==='all'?'':`<div class="profile-subnav">${SOURCE_NAV.map(([type,label,icon])=>`<button class="profile-focus-link ${state.category===k&&state.view==='sources'&&state.sourceType===type?'active':''}" data-source-profile="${k}" data-source-type="${type}" aria-label="${e(PROFILES[k].label)}的${label}" title="${e(PROFILES[k].label)}的${label}" ${state.category===k&&state.view==='sources'&&state.sourceType===type?'aria-current="page"':''}><span aria-hidden="true">${icon}</span><span class="focus-label">${label}</span></button>`).join('')}</div>`}</div>`).join('');
  $('read-select').value=state.readStatus;
  $('issue-panel').innerHTML=state.view==='feed'?issueReport(days.find(d=>d.date===state.date)||days[0]):'';
  updateViewChrome();
  renderMap();
  if (state.view === 'feed') updateHUD({demo:state.demo,papers,days});
  $('bookmark-transfer').hidden = state.view !== 'bookmarks';
  const tags = availableTopics(papers,state.category);
  document.querySelectorAll('nav [data-view]').forEach(b => { b.classList.toggle('active',b.dataset.view === state.view); if(b.dataset.view===state.view) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  $('bookmark-count').textContent = papers.filter(p=>bookmarks.has(p.id)).length;
  $('search').value = state.q;
  const dateValues = days.map(d=>d.date);
  $('date-select').innerHTML = '<option value="all">全部日期</option>' + (state.date !== 'all' && !dateValues.includes(state.date) ? `<option value="${state.date}">${state.date}（无档案）</option>` : '') + days.map(d=>`<option value="${d.date}">${d.date}</option>`).join('');
  $('date-select').value = state.date;
  const tagValues = state.tag !== 'all' && !tags.includes(state.tag) ? [...tags,state.tag] : tags;
  $('tags').innerHTML = ['all',...tagValues].map(t=>`<button class="tag ${state.tag===t?'active':''}" data-tag="${e(t)}" aria-pressed="${state.tag===t}">${t==='all'?'全部':e(t.startsWith('topic:')?topicLabel(t):'关键词：'+t)}</button>`).join('');
  $('date-list').innerHTML = days.length ? days.slice(0,4).map(d=>`<button class="date-item ${state.date===d.date?'active':''}" data-date="${d.date}" aria-label="查看 ${d.date}，${d.papers.length} 篇${state.demo?'演示条目':'论文'}"><span class="date-number">${d.date.slice(8)}</span><span class="date-meta">${d.date.slice(0,7).replace('-',' / ')}<small>${state.demo?'演示归档':'研究档案'}</small></span><span class="date-count">${String(d.papers.length).padStart(2,'0')} ↗</span></button>`).join('') : '<div class="archive-placeholder">暂无归档</div>';
  const filtered = filterPapers(papers,{...state,read:reads,bookmarks:state.view==='bookmarks'?bookmarks:null});
  $('institution-gallery').innerHTML=state.view==='feed'&&!state.demo?institutionGallery(filtered,data.institutions):'';
  const isFiltered = state.q || state.tag!=='all' || state.date!=='all' || state.category!=='all' || state.readStatus!=='all';
  $('view-title').childNodes[0].textContent = state.view === 'sources' ? (SOURCE_NAV.find(([type])=>type===state.sourceType)||SOURCE_NAV[0])[1] : state.view === 'archive' ? '日期归档' : state.view === 'bookmarks' ? '本机书签' : state.category==='all'?'每日精选':PROFILES[state.category].label+'的推送';
  $('edition-label').textContent = state.demo ? '演示档案' : !days.length ? '等待首期' : state.date === 'all' ? '全部日期' : state.date;
  $('edition-status').textContent = state.demo ? 'DEMO / NOT REAL PAPERS' : papers.length ? 'CURATED & ARCHIVED' : 'AWAITING SIGNAL';
  const isSources=state.view==='sources';
  $('result-bar').hidden=isSources;
  if(isSources){$('edition-label').textContent=PROFILES[state.category]?.label || '全部方向';$('edition-status').textContent='SOURCE WATCHLIST';}
  $('filter-panel').hidden = state.view==='archive'||isSources;
  $('clear-filters').hidden = !isFiltered || state.view==='archive'||isSources;
  $('result-count').textContent = state.view==='archive' ? `${days.length} 个${state.demo?'演示':'真实'}日期档案` : papers.length ? `${filtered.length} / ${papers.length} 篇${state.demo?'演示条目 · 非真实论文':'论文'}${state.view==='bookmarks'?' · 仅本机收藏':''}` : '真实论文 0 篇 · 筛选规则待设定';
  if(isSources){$('result-count').textContent='';$('content').innerHTML=sourceDirectory(state.category,watchlists,state.sourceType);}
  else if (state.view==='archive' && days.length) $('content').innerHTML = `<div class="archive-grid">${days.map(d=>`<button class="archive-card" data-date="${d.date}"><p class="eyebrow">${state.demo?'DEMO ARCHIVE':'DAILY ARCHIVE'}</p><strong>${d.date.replaceAll('-',' / ')}</strong><p>${e(d.title)}</p><span>${d.papers.filter(p=>!p.classic).length} 篇${state.demo?'演示条目':'精选'}${d.papers.some(p=>p.classic)?' + '+d.papers.filter(p=>p.classic).length+' 篇经典':''} <span aria-hidden="true">↗</span></span></button>`).join('')}</div>`;
  else if (!papers.length) $('content').innerHTML = emptyState('first');
  else if (!filtered.length) $('content').innerHTML = emptyState(state.view==='bookmarks' && !isFiltered ? 'bookmarks':'filtered');
  else $('content').innerHTML = `<div class="paper-list">${filtered.map(paperCard).join('')}</div>`;
  $('content').setAttribute('aria-busy','false');
  renderDialog();
  if (focusSelector && !active.isConnected && !$('detail-dialog').open) document.querySelector(focusSelector)?.focus({preventScroll:true});
}

function renderDialog() {
  if ($('notes-dialog').open) return;
  const dialog = $('detail-dialog');
  if (!state.paper) {
    if (dialog.open) dialog.close();
    lastDialogPaper = '';
    return;
  }
  const p = filterPapers(collection().papers,{date:mapPaper===state.paper?'all':state.date}).find(p => p.id===state.paper);
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
  $('dialog-content').innerHTML = `${p.demo?`<p class="dialog-warning">${DEMO_NOTICE}。</p>`:''}<h2 id="dialog-title">${e(p.title)}</h2>${p.titleEn?`<p>${e(p.titleEn)}</p>`:''}<div class="dialog-meta">${e(p.authors.join(' · '))}<br>${e(p.venue)} / ${p.year} / 收录于 ${p.date}</div><h3>中文导读</h3><p>${e(p.summary)}</p>${bilingualDetail(p)}<h3>为什么入选</h3><p>${e(p.whySelected)}</p><h3>研究主题</h3><div class="card-tags">${p.tags.map(t=>`<span class="card-tag">${e(t)}</span>`).join('')}</div><h3>原始来源</h3>${p.sources.length?`<div class="source-links">${p.sources.map(s=>`<a href="${e(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.label)} ↗</a>`).join('')}</div>`:'<p>演示条目无真实论文来源。</p>'}<button class="secondary-button dialog-bookmark" data-bookmark="${e(p.id)}" aria-pressed="${bookmarks.has(p.id)}">${bookmarks.has(p.id)?'◆ 已加入本机书签':'◇ 加入本机书签'}</button>`;
  $('dialog-content').insertAdjacentHTML('beforeend',noteButton(p,notes.has(p.id))+digestDetails(p));
  if (!dialog.open) dialog.showModal();
}

function closeDialog() {
  const paperId = state.paper;
  if (state.paper) go({paper:''});
  else $('detail-dialog').close();
  if (dialogTrigger?.isConnected) dialogTrigger.focus();
  else if (mapPaper===paperId) document.querySelector(`[data-map-paper="${CSS.escape(paperId)}"]`)?.focus({preventScroll:true});
  else if (paperId) document.querySelector(`[data-paper="${CSS.escape(paperId)}"]`)?.focus({preventScroll:true});
}

document.addEventListener('click', event => {
  const b = event.target.closest('button');
  if (!b) return;
  if(b.dataset.note){openNotes(b.dataset.note,b);return;}
  if(b.dataset.mapMode){mapMode=b.dataset.mapMode==='today'?'today':'all';mapRegion='';renderMap();document.querySelector(`[data-map-mode="${mapMode}"]`)?.focus({preventScroll:true});return;}
  if(b.dataset.mapRegion){mapRegion=b.dataset.mapRegion;renderMap();document.querySelector(`[data-map-region="${CSS.escape(mapRegion)}"]`)?.focus({preventScroll:true});return;}
  if(b.dataset.mapClear){const previous=mapRegion;mapRegion='';renderMap();document.querySelector(`[data-map-region="${CSS.escape(previous)}"]`)?.focus({preventScroll:true});return;}
  if(b.dataset.mapPaper){mapPaper=b.dataset.mapPaper;dialogTrigger=b;go({paper:mapPaper});return;}

  if(b.dataset.guideToggle){const id=b.dataset.guideToggle;if(expandedGuides.has(id))expandedGuides.delete(id);else expandedGuides.add(id);render();return;}
  if(b.dataset.institutionScroll){scrollInstitutions($('institution-strip'),Number(b.dataset.institutionScroll));return;}
  if(PROFILES[b.dataset.sourceProfile]){go({category:b.dataset.sourceProfile,sourceType:SOURCE_NAV.some(([type])=>type===b.dataset.sourceType)?b.dataset.sourceType:'conference',view:'sources',paper:''});return;}
  if(b.dataset.action==='sources'){go(sourceViewPatch(state));return;}
  if(b.dataset.category)go({category:b.dataset.category,tag:topicForProfile(collection().papers,state.tag,b.dataset.category),view:['archive','sources'].includes(state.view)?'feed':state.view,paper:''});
  else if(b.dataset.read){if(reads.has(b.dataset.read))reads.delete(b.dataset.read);else reads.add(b.dataset.read);try{localStorage.setItem(READ_KEY,JSON.stringify([...reads]));}catch{toast('阅读状态仅在当前会话可用');}render();}
  else if (b.dataset.view) go({view:b.dataset.view,q:'',tag:'all',date:b.dataset.view==='feed'&&!state.demo&&data?.real.days[0]?data.real.days[0].date:'all',paper:''});
  else if(b.dataset.share)requestShare(b.dataset.share);
  else if (b.dataset.paper) { mapPaper=''; dialogTrigger = b; go({paper:b.dataset.paper}); }
  else if (b.dataset.bookmark) toggleBookmark(b.dataset.bookmark);
  else if (b.dataset.tag) go({tag:b.dataset.tag,view:state.view==='archive'?'feed':state.view,paper:''});
  else if (b.dataset.date) go({date:b.dataset.date,view:'feed',q:'',tag:'all',paper:''});
  else if (b.dataset.action === 'demo') go({demo:true,view:'feed',date:'all',tag:'all',q:'',paper:''});
  else if (b.dataset.action === 'clear') go({q:'',tag:'all',date:'all',category:'all',readStatus:'all'});
  else if (b.dataset.action === 'feed') go({view:'feed',q:'',tag:'all',date:'all'});
  else if (b.dataset.action === 'retry') init();
});
async function requestShare(id){
  const paper=filterPapers(collection().papers,{date:state.date}).find(p=>p.id===id);if(!paper)return;
  const request=++shareRequest;
  const url=publicPaperURL(location.href,paper);
  const result=await sharePaper({url,title:paper.title},{share:navigator.share?.bind(navigator),copy:navigator.clipboard?.writeText?.bind(navigator.clipboard)});
  if(request!==shareRequest)return;
  if(result==='copied')toast('论文链接已复制');
  else if(result==='manual'){$('share-url').value=url;$('share-status').textContent='复制论文链接。';$('share-dialog').showModal();$('share-url').focus();$('share-url').select();}
}
$('share-close').addEventListener('click',()=>{shareRequest++;$('share-dialog').close();});
$('share-dialog').addEventListener('cancel',()=>{shareRequest++;});
$('share-dialog').addEventListener('click',event=>{if(event.target===$('share-dialog')){const r=$('share-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom){shareRequest++;$('share-dialog').close();}}});
$('share-copy').addEventListener('click',async()=>{
  const request=shareRequest;
  const result=await sharePaper({url:$('share-url').value,title:document.title},{copy:navigator.clipboard?.writeText?.bind(navigator.clipboard)});
  if(request!==shareRequest||!$('share-dialog').open)return;
  $('share-status').textContent=result==='copied'?'链接已复制。':'请手动复制链接。';
  if(result!=='copied'){$('share-url').focus();$('share-url').select();}
});
document.addEventListener('error',event=>{if(event.target?.matches?.('img[data-media-image]'))handleMediaError(event.target);},true);
$('search').addEventListener('input', event => go({q:event.target.value},{replace:true}));
$('read-select').addEventListener('change',event=>go({readStatus:event.target.value}));
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
  $('transfer-status').textContent=`已导出 ${bookmarks.size} 条书签。`;
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
    $('transfer-status').textContent=`导入成功：新增 ${result.added} 条，已有 ${result.duplicates} 条，总计 ${bookmarks.size} 条。${unknown?`${unknown} 条 ID 暂未在本站收录，已保留。`:''}`;
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
  $('dialog-content').innerHTML = '<h2 id="dialog-title">零域 / ZERO FIELD</h2><p>迅、李、驴的每日论文精选。</p><p>书签、已读与笔记仅保存在本机，不会自动同步；清除浏览器数据会删除记录。</p><p>研究足迹按已核验的作者署名机构所在城市点亮；跨地区论文可点亮多处，篇数按论文去重。城市点位为示意，不代表国籍。底图：<a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth · 公共领域</a>，仅显示陆地轮廓。</p>';
  $('detail-dialog').showModal();
});
function syncRoute(){if(location.hash==='#main')return;closeNotes(false);shareRequest++;if($('share-dialog').open)$('share-dialog').close();state=readRoute(location.hash);updateViewChrome();if(data)render();}
window.addEventListener('popstate',syncRoute);
window.addEventListener('hashchange',syncRoute);
// Refresh date-sensitive counts after returning to an overnight-open tab.
window.addEventListener('focus',()=>{if(data&&state.view==='feed'&&!state.demo)renderMap();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&data&&state.view==='feed'&&!state.demo)renderMap();});
window.addEventListener('storage',event=>{if(event.key===BOOKMARK_KEY){bookmarks=parseBookmarks(event.newValue);if(data)render();}});
document.addEventListener('keydown',event=>{if(event.key==='/' && !event.ctrlKey && !event.metaKey && !event.altKey && !$('detail-dialog').open && !$('share-dialog').open && !$('notes-dialog').open && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !$('filter-panel').hidden){event.preventDefault();$('search').focus();}});
function updateNoteButtons() {
  document.querySelectorAll('[data-note]').forEach(button=>{
    const has=notes.has(button.dataset.note);
    button.classList.toggle('has-note',has);
    button.title=has?'编辑笔记（已有内容）':'添加笔记';
    button.setAttribute('aria-label',`${button.title}：${button.dataset.noteTitle||''}`);
  });
}
function noteStatus(saved) {
  $('notes-status').textContent=notes.conflict?'另一标签页已修改笔记 · 请先导出本页草稿，再重新加载':notes.loadError?'本机笔记读取失败 · 新内容仅在此页，关闭页面前请导出':saved?'已保存到本机':'尚未保存到本机 · 请重试或导出，关闭页面会丢失';
  $('notes-status').classList.toggle('error',!saved||notes.loadError);
  $('notes-count').textContent=`${$('notes-text').value.length} / ${MAX_NOTE_LENGTH}`;
}
function flushNotes() {
  clearTimeout(noteTimer);
  const saved=notes.flush();
  noteStatus(saved);
  updateNoteButtons();
  return saved;
}
function captureNote() {
  if(!noteId)return;
  try { notes.set(noteId,$('notes-text').value); }
  catch(error){$('notes-status').textContent=error.message;return;}
  $('notes-count').textContent=`${$('notes-text').value.length} / ${MAX_NOTE_LENGTH}`;
  $('notes-status').textContent='正在保存…';
  clearTimeout(noteTimer);noteTimer=setTimeout(flushNotes,350);
}
function openNotes(id,trigger) {
  const paper=collection().papers.find(p=>p.id===id);if(!paper)return;
  if(noteId===id&&$('notes-dialog').open){$('notes-text').focus();return;}
  if(noteId)closeNotes(false);
  shareRequest++;if($('share-dialog').open)$('share-dialog').close();
  resumeDetail=$('detail-dialog').open;
  if(resumeDetail)$('detail-dialog').close();
  noteId=id;noteTrigger=trigger;
  $('notes-paper-title').textContent=paper.title;
  $('notes-text').value=notes.get(id);
  $('notes-export-preview').hidden=true;
  $('notes-transfer-status').textContent='';
  noteStatus(!notes.dirty&&!notes.loadError);
  $('notes-dialog').showModal();$('notes-text').focus();
}
function closeNotes(restore=true) {
  if(!noteId)return;
  const saved=flushNotes();
  if(!saved)toast('笔记未保存到本机，草稿仍保留在本页；请导出备份');
  const trigger=noteTrigger,id=noteId,detail=resumeDetail;
  noteId='';resumeDetail=false;
  $('notes-dialog').close();
  if(restore){
    if(detail&&state.paper)$('detail-dialog').showModal();
    if(trigger?.isConnected)trigger.focus({preventScroll:true});
    else document.querySelector(`[data-note="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
  }
}
$('notes-text').addEventListener('input',captureNote);
$('notes-close').addEventListener('click',()=>closeNotes());
$('notes-retry').addEventListener('click',flushNotes);
$('notes-dialog').addEventListener('cancel',event=>{event.preventDefault();closeNotes();});
$('notes-dialog').addEventListener('click',event=>{if(event.target===$('notes-dialog')){const r=$('notes-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeNotes();}});
$('notes-delete').addEventListener('click',()=>{
  if(!noteId||!notes.get(noteId)||!window.confirm('删除这篇论文的本机笔记？此操作不可撤销。'))return;
  $('notes-text').value='';captureNote();flushNotes();$('notes-text').focus();
});
function exportNotes(onlyCurrent=false) {
  flushNotes();
  try {
    const text=notes.export(onlyCurrent?noteId:undefined);$('notes-export-json').value=text;$('notes-export-preview').hidden=false;
    const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=onlyCurrent?`paper-signal-notes-${noteId}.json`:'paper-signal-notes.json';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    $('notes-transfer-status').textContent=onlyCurrent?'已生成本篇笔记备份。':'已生成全部笔记备份；请妥善保存，不要公开上传。';
  }catch(error){$('notes-transfer-status').textContent=`${error.message}。可先导出本篇笔记，或复制编辑框中的内容。`;}
}
$('notes-export').addEventListener('click',()=>exportNotes());
$('notes-export-current').addEventListener('click',()=>exportNotes(true));
function importNotes(text) {
  const result=notes.import(text);
  if(noteId)$('notes-text').value=notes.get(noteId);
  noteStatus(true);updateNoteButtons();
  $('notes-transfer-status').textContent=`新增 ${result.added} 条，重复 ${result.duplicates} 条；跳过 ${result.conflicts} 条不同内容（保留本机笔记）。`;
}
$('notes-import').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try {if(file.size>MAX_NOTES_BYTES)throw new Error('文件过大：最多 2 MB');importNotes(await file.text());}
  catch(error){$('notes-transfer-status').textContent=`导入失败，原笔记未改变：${error.message}`;}
  finally{event.target.value='';}
});
$('notes-import-pasted').addEventListener('click',()=>{try{importNotes($('notes-import-json').value);}catch(error){$('notes-transfer-status').textContent=`导入失败，原笔记未改变：${error.message}`;}});
window.addEventListener('pagehide',flushNotes);
window.addEventListener('beforeunload',event=>{if(!flushNotes()&&notes.dirty){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushNotes();});
init();

document.addEventListener('keydown',event=>{const strip=$('institution-strip');if(strip)institutionKeydown(event,strip);});
