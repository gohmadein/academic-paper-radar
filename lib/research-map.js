import {escapeHTML as e} from './model.js';
import {WORLD_LAND} from './world-land.js';

export function beijingDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
// Scope by the profile on each actual push occurrence, not publication year or
// the merged paper's union of profiles. Never substitute the latest issue for today.
export function researchMapModel(papers, geography, {profile='all',mode='all',today=beijingDate()}={}) {
  const selected=new Map();
  for(const paper of papers) for(const occurrence of paper.appearances || [paper]) {
    if(profile!=='all'&&!occurrence.profiles?.includes(profile))continue;
    if(mode==='today'&&occurrence.date!==today)continue;
    if(!selected.has(paper.id))selected.set(paper.id,paper);
  }
  const groups=new Map(),unresolved=new Set();let unknown=0,mapped=0;
  for(const paper of selected.values()) {
    for(const id of geography?.papers?.[paper.id]?.unresolvedInstitutionIds||[])unresolved.add(id);
    const ids=geography?.papers?.[paper.id]?.locationIds || [];
    const locations=ids.map(id=>geography?.locations?.[id]).filter(l=>l&&Number.isFinite(l.lat)&&Number.isFinite(l.lon));
    if(!locations.length){unknown++;continue;} mapped++;
    for(const l of locations){
      const key=`${l.countryCode}:${l.city}`;
      if(!groups.has(key))groups.set(key,{id:key,label:`${l.labelZh||l.city} · ${l.countryLabelZh||l.countryLabel}`,lat:l.lat,lon:l.lon,papers:[],institutions:[]});
      const g=groups.get(key);
      if(!g.papers.some(p=>p.id===paper.id))g.papers.push(paper);
      if(!g.institutions.includes(l.label))g.institutions.push(l.label);
    }
  }
  return {today,mode,total:selected.size,mapped,unknown,unresolved:unresolved.size,groups:[...groups.values()].sort((a,b)=>a.label.localeCompare(b.label,'zh-CN'))};
}
export function researchMapHTML(model,selection='',{compact=false}={}) {
  const selected=model.groups.find(g=>g.id===selection);
  const name=model.mode==='today'?'今日推送':'累计推送';
  const regions=model.groups.map(g=>`<button data-map-region="${e(g.id)}" aria-pressed="${selected?.id===g.id}">${e(g.label)} <strong>${g.papers.length}</strong></button>`).join('');
  return `<div class="map-heading"><div>${compact?'':'<p class="eyebrow">RESEARCH ATLAS</p>'}<h3 id="research-map-title">研究足迹</h3></div><div class="map-modes" role="group" aria-label="地图推送时间范围"><button data-map-mode="all" aria-pressed="${model.mode==='all'}">累计推送</button><button data-map-mode="today" aria-pressed="${model.mode==='today'}">今日推送</button></div></div>
    <p class="map-summary" role="status"><span class="map-key ${model.mode==='today'?'today':''}" aria-hidden="true"></span>${compact?`已定位 <strong>${model.mapped??model.total}</strong> / ${model.total} 篇 · ${model.groups.length} 个地区`:`${name} <strong>${model.total}</strong> 篇 · <strong>${model.groups.length}</strong> 个地区${model.unknown?` · ${model.unknown} 篇地区待核验`:''}`}</p>
    <div class="map-surface ${model.mode==='today'?'map-today':''}"><svg viewBox="0 0 720 360" aria-hidden="true" focusable="false"><path class="map-graticule" d="M0 180H720M0 90H720M0 270H720M180 0V360M360 0V360M540 0V360"/><path class="map-land" fill-rule="evenodd" d="${WORLD_LAND}"/></svg>${model.groups.map(g=>`<button class="map-marker ${selected?.id===g.id?'selected':''}" data-map-x="${((g.lon+180)/360*100).toFixed(3)}" data-map-y="${((90-g.lat)/180*100).toFixed(3)}" data-map-region="${e(g.id)}" aria-label="${e(g.label)}，${g.papers.length} 篇论文" aria-pressed="${selected?.id===g.id}" title="${e(g.label)} · ${g.papers.length} 篇"><span></span></button>`).join('')}</div>
    <div class="map-browser" tabindex="0" role="region" aria-label="地区浏览与论文列表">${compact?'':`<p class="map-scope">${e(model.today)} 北京时间 · 当前方向 · 不受下方筛选影响</p>`}
    ${!model.total?`<p class="map-empty">${model.mode==='today'?'今天尚无推送。切换「累计推送」查看已有足迹。':'尚无推送。'}</p>`:''}
    ${model.total&&!model.groups.length?'<p class="map-empty">署名地区待核验，论文仍可在下方阅读。</p>':''}
    ${selected?`<section class="map-results" aria-label="地区论文"><div><strong>${e(selected.label)} · ${selected.papers.length} 篇</strong><button data-map-clear="true" aria-label="关闭地区论文列表">关闭 ×</button></div><ul>${selected.papers.map(p=>`<li><button data-map-paper="${e(p.id)}">${e(p.title)} <span aria-hidden="true">↗</span></button></li>`).join('')}</ul></section>`:''}
    ${!compact&&model.unresolved?`<p class="map-scope">${model.unresolved} 个署名机构的地区待核验，未标点</p>`:''}
    ${model.groups.length?(compact?`<section id="map-region-list" class="map-regions map-regions-direct" aria-label="地区"><h4>地区</h4><div>${regions}</div></section>`:`<details id="map-regions" class="map-regions"><summary>按地区浏览 <span>${model.groups.length}</span></summary><div>${regions}</div></details>`):''}</div>`;
}

// CSP intentionally forbids style attributes in HTML. Assign individual CSSOM
// properties from this trusted local module instead; never use cssText/setAttribute.
export function positionMapMarkers(root) {
  for(const marker of root.querySelectorAll('.map-marker')) {
    const x=Number(marker.dataset.mapX),y=Number(marker.dataset.mapY);
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>100||y<0||y>100)continue;
    marker.style.left=`${x}%`;
    marker.style.top=`${y}%`;
  }
}
