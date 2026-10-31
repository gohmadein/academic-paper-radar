import {profileIcon} from './profile-icons.js';
import {escapeHTML as e,safeUrl,PROFILES} from './model.js';

export const SOURCE_SECTIONS = [['conference','会议'],['journal','期刊'],['lab','实验室 / 团队 / 项目'],['arxiv','arXiv'],['author','作者']];
export function sourceViewPatch(state){return {view:state.view==='sources'?'feed':'sources',paper:''};}
export function profileSources(category,watchlists){
  const profile=watchlists.profiles.profiles[category];
  const registered=category==='xun'?watchlists.registry.sources:(profile.registryRefs||[]).map(name=>{
    const source=watchlists.registry.sources.find(source=>source.name===name);
    if(!source)throw new Error(`未知来源引用：${name}`);
    return source;
  });
  return [...new Map([...registered,...profile.sources].map(source=>[`${source.type}:${source.name}`,source])).values()];
}
function entry(source){
  return `<li class="watchlist-entry"><strong>${e(source.name)}</strong>${source.details.length?`<p>${source.details.map(e).join(' · ')}</p>`:''}<div class="watchlist-links">${source.links.filter(link=>safeUrl(link.url)).map(link=>`<a href="${e(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">${e(link.label)} ↗</a>`).join('')}</div></li>`;
}
export const SOURCE_NAV = [['conference','会议','会'],['journal','期刊','刊'],['lab','实验室','研']];
export function sourceDirectory(category,watchlists,sourceType='conference'){
  const selected=SOURCE_NAV.find(([type])=>type===sourceType)||SOURCE_NAV[0];
  const sectionTitle=selected[1];
  const returnButton='<button class="secondary-button" data-action="sources">返回论文推送 ↗</button>';
  if(!watchlists)return `<section class="source-directory"><h3>来源目录暂时无法读取</h3><p>论文档案仍可使用，请重新加载页面后重试。</p>${returnButton}</section>`;
  if(!PROFILES[category])return `<section class="source-directory"><p class="eyebrow">FOLLOW THE SOURCES</p><h3>选择一个方向，查看关注名单</h3><div class="source-profile-grid">${Object.entries(PROFILES).map(([key,profile])=>`<button class="source-profile-card profile-${key}" data-source-profile="${key}" data-source-type="conference"><strong>${profileIcon(key)}${e(profile.label)} · 会议</strong><span>会议目录 · 期刊与实验室请从侧栏打开 →</span></button>`).join('')}</div>${returnButton}</section>`;
  const sources=profileSources(category,watchlists);
  return `<section class="source-directory" aria-label="${e(PROFILES[category].label)}的${e(sectionTitle)}"><header class="watchlist-header"><div><p class="eyebrow">FOLLOW THE SOURCES / ${e(category.toUpperCase())}</p><h3>${e(PROFILES[category].label)} · ${e(sectionTitle)}</h3></div>${returnButton}</header><div class="watchlist-sections">${SOURCE_SECTIONS.filter(([type])=>type===selected[0]).map(([type,label])=>{
    const entries=sources.filter(s=>s.type===type),tiers=[...new Set(entries.map(s=>s.tier))];
    return `<details class="watchlist-section" open><summary><span>${e(label)}</span><span class="watchlist-count">${entries.length?`${entries.length} 项`:'待补充'}</span></summary>${entries.length?tiers.map(tier=>`<section class="watchlist-group"><h4>${e(category==='lv'?tier.replace(/（[^）]*）/g,''):tier)}</h4><ul>${entries.filter(s=>s.tier===tier).map(entry).join('')}</ul></section>`).join(''):`<p class="watchlist-pending">待补充</p>`}</details>`;
  }).join('')}</div></section>`;
}
