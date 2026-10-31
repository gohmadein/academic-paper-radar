import {escapeHTML as e,safeUrl,PROFILES} from './model.js';

export const SOURCE_SECTIONS = [['conference','会议'],['journal','期刊'],['lab','实验室 / 团队 / 项目'],['arxiv','arXiv'],['author','作者']];
export function sourceViewPatch(state){return {view:state.view==='sources'?'feed':'sources',paper:''};}
export function profileSources(category,watchlists){
  return category==='xun' ? [...watchlists.registry.sources,...watchlists.profiles.profiles.xun.sources] : watchlists.profiles.profiles[category].sources;
}
function entry(source){
  return `<li class="watchlist-entry"><strong>${e(source.name)}</strong>${source.details.length?`<p>${source.details.map(e).join(' · ')}</p>`:''}<div class="watchlist-links">${source.links.filter(link=>safeUrl(link.url)).map(link=>`<a href="${e(safeUrl(link.url))}" target="_blank" rel="noopener noreferrer">${e(link.label)} ↗</a>`).join('')}</div></li>`;
}
export function sourceDirectory(category,watchlists){
  const returnButton='<button class="secondary-button" data-action="sources">返回论文推送 ↗</button>';
  if(!watchlists)return `<section class="source-directory"><h3>关注重点暂时无法读取</h3><p>论文档案仍可使用，请重新加载页面后重试。</p>${returnButton}</section>`;
  if(!PROFILES[category])return `<section class="source-directory"><p class="eyebrow">FOLLOW THE SOURCES</p><h3>选择一个方向，查看关注名单</h3><p class="watchlist-notice">这是长期关注目录，不是每日检索完成清单；每期实际覆盖以当期导读为准。</p><div class="source-profile-grid">${Object.entries(PROFILES).map(([key,profile])=>`<button class="source-profile-card profile-${key}" data-source-profile="${key}"><strong>${e(profile.label)} · 关注重点</strong><span>${key==='lv'?'会议、期刊、团队等 · 待补充':'会议、期刊、团队、arXiv 与作者'} →</span></button>`).join('')}</div>${returnButton}</section>`;
  const profile=watchlists.profiles.profiles[category],sources=profileSources(category,watchlists);
  return `<section class="source-directory" aria-label="${e(PROFILES[category].label)}的关注重点"><header class="watchlist-header"><div><p class="eyebrow">FOLLOW THE SOURCES / ${e(category.toUpperCase())}</p><h3>${e(PROFILES[category].label)} · 关注重点</h3></div>${returnButton}</header><p class="watchlist-scope">${e(profile.scope)}</p><p class="watchlist-notice">这是长期关注名单，不要求每天覆盖所有来源，也不代表全部来源已被检索。每期实际检索范围与限制以当期导读为准。预印本须明确标注。</p>${profile.notes.length?`<ul class="watchlist-notes">${profile.notes.map(note=>`<li>${e(note)}</li>`).join('')}</ul>`:''}<div class="watchlist-sections">${SOURCE_SECTIONS.map(([type,label])=>{
    const entries=sources.filter(s=>s.type===type),tiers=[...new Set(entries.map(s=>s.tier))];
    return `<details class="watchlist-section" open><summary><span>${e(label)}</span><span class="watchlist-count">${entries.length?`${entries.length} 项`:'待补充'}</span></summary>${entries.length?tiers.map(tier=>`<section class="watchlist-group"><h4>${e(tier)}</h4><ul>${entries.filter(s=>s.tier===tier).map(entry).join('')}</ul></section>`).join(''):`<p class="watchlist-pending">待补充${category==='xun'&&type==='author'?' · 代表学者已随实验室条目保留；独立作者名单待补充。':' · 尚未提供此部分关注名单。'}</p>`}</details>`;
  }).join('')}</div></section>`;
}
