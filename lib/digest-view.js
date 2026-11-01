import {noteButton} from './notes-view.js';
import {profileIcon} from './profile-icons.js';
import {PROFILES,STATUS_LABELS,DEPTH_LABELS,DIFFICULTY_LABELS,READING_LABELS,escapeHTML as e,safeUrl} from './model.js';
import {institutionRow,authorRow,figurePanel,mediaProvenance} from './paper-media.js';
const profiles=p=>(Array.isArray(p.profiles)?p.profiles:[]).filter(k=>Object.hasOwn(PROFILES,k));
const items=list=>(list||[]).map(x=>`<li>${e(x)}</li>`).join('');
export function categoryClass(p,category){const keys=profiles(p);return category!=='all'&&PROFILES[category]?`category-${category}`:keys.length>1?'category-multiple':keys.length?`category-${keys[0]}`:'';}
export function categoryRail(p){return profiles(p).length>1?`<div class="profile-rail" aria-hidden="true">${profiles(p).map(k=>`<span class="profile-${k}"></span>`).join('')}</div>`:'';}
export function digestBadges(p){
 if(!p.profiles)return '';
 const novelty=p.classic?'周一经典':({recent:'近30日论文','older-discovery':'较早论文 · 首次发现','major-update':'实质更新'})[p.novelty];
 return `<div class="digest-badges">${profiles(p).map(k=>`<span class="profile-badge profile-${k}">${profileIcon(k)}${PROFILES[k].label}</span>`).join('')}<span class="status-badge status-${e(p.publicationStatus)}">${e(STATUS_LABELS[p.publicationStatus])}</span><span class="novelty-badge">${e(novelty)}</span><span class="depth-badge">${e(DEPTH_LABELS[p.readDepth])}</span></div>`;
}
export function digestRecommendations(p,category,detail=false){
 if(!p.profiles)return '';
 const keys=category&&category!=='all'?profiles(p).filter(k=>k===category):profiles(p);
 return `<div class="profile-recommendations">${keys.map(k=>{const r=p.recommendations[k];return `<section class="profile-recommendation profile-${k}"><div class="recommendation-heading"><strong>${PROFILES[k].label} · 推荐理由</strong><span>${e(DIFFICULTY_LABELS[r.difficulty])} / ${e(READING_LABELS[r.readRecommendation])}</span></div><p>${e(r.whyRead)}</p>${detail?`<p><strong>方向关联：</strong>${e(r.relation)}</p><p><strong>阅读前置：</strong>${e(r.prerequisites.join(' · ')||'无额外前置要求记录')}</p>`:''}</section>`;}).join('')}</div>`;
}
export function digestDetails(p){
 if(!p.profiles)return '';
 const names={code:'代码',project:'项目',video:'视频',data:'数据'};
 const resources=Object.entries(p.links).filter(([,url])=>safeUrl(url)).map(([k,url])=>`<a href="${e(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${names[k]} ↗</a>`).join('');
 return `<section class="digest-detail"><h3>类别与阅读建议</h3>${digestBadges(p)}${digestRecommendations(p,'all',true)}<dl class="verification-meta"><div><dt>发表状态</dt><dd>${e(STATUS_LABELS[p.publicationStatus])}</dd></div><div><dt>发表日期</dt><dd>${e(p.publicationDate||`${p.year}（具体日期未核实）`)}</dd></div><div><dt>发现 / 核验</dt><dd>${e(p.discoveredDate)} / ${e(p.verifiedAt)}</dd></div><div><dt>阅读深度</dt><dd>${e(DEPTH_LABELS[p.readDepth])}，不代表完整审稿或复现</dd></div></dl>${p.updateNote?`<h3>本次实质变化</h3><p>${e(p.updateNote)}</p>`:''}<h3>已核验资源</h3><div class="source-links">${resources||'<span class="resource-missing">暂无独立核验的代码、项目、视频或数据链接；不代表资源不存在。</span>'}</div><h3>局限与假设</h3><ul>${items([...p.assumptions,...p.limits])}</ul><h3>阅读与核验记录</h3><ul>${items(p.researchNotes)}</ul><details class="evidence-details"><summary>原始证据（${p.evidence.length}）</summary><ul>${p.evidence.map(s=>`<li><a href="${e(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.claim)} ↗</a><small>核验：${e(s.checkedAt)}</small></li>`).join('')}</ul></details></section>`;
}
export function issueReport(day){
 if(day?.version!==2)return '';
 const p=day.papers;
 return `<div class="issue-report"><div class="issue-report-heading"><strong>${e(day.date)} · 本期导读</strong><span>${p.filter(x=>!x.classic&&x.novelty==='recent').length} 篇近30日 / ${p.filter(x=>!x.classic&&x.novelty==='older-discovery').length} 篇回溯 / ${p.filter(x=>x.classic).length} 篇经典</span></div><details><summary>实际检索范围与限制</summary><h3>已检查入口</h3><ul>${items(day.coverage.checkedSources)}</ul><h3>覆盖边界</h3><ul>${items(day.coverage.limitations)}</ul></details></div>`;
}

export function editorialCard(p,index,{category='all',saved=false,read=false,expanded=false,hasNote=false}={}){
 const publication=p.publicationDate||`${p.year}（具体日期未核实）`;
 return `<article class="paper-card editorial-card ${categoryClass(p,category)}">${categoryRail(p)}
   <div class="editorial-grid"><div class="editorial-copy">
     <h3><button class="title-button" data-paper="${e(p.id)}">${e(p.title)}</button></h3>
     <p class="paper-title-original" lang="en">${e(p.titleEn)}</p>
     <div class="paper-people">${institutionRow(p)}${authorRow(p)}</div>
     <div id="guide-${e(p.id)}" class="bilingual-guide ${expanded?'is-expanded':''}"><div class="guide-language"><span>中文导读</span><p lang="zh-CN">${e(p.summary)}</p></div><div class="guide-language english-guide"><span>ENGLISH GUIDE · TRANSLATION</span><p lang="en">${e(p.summaryEn)}</p></div></div>
     <button class="guide-toggle" data-guide-toggle="${e(p.id)}" aria-controls="guide-${e(p.id)}" aria-expanded="${expanded}">${expanded?'收起导读':'展开双语导读'} <span aria-hidden="true">${expanded?'−':'+'}</span></button>
     <div class="editorial-top">${digestBadges(p)}</div>
     <details class="card-reading-details"><summary>方向推荐与阅读建议</summary>${digestRecommendations(p,category,true)}</details>
   </div><div class="editorial-visual">${figurePanel(p)}</div></div>
   <div class="editorial-footer"><div class="paper-dates"><span>发表 <time ${p.publicationDate?`datetime="${e(p.publicationDate)}"`:''}>${e(publication)}</time></span><span>收录 <time datetime="${e(p.date)}">${e(p.date)}</time></span></div><div class="card-actions">
     <button class="read-button ${read?'is-read':''}" data-read="${e(p.id)}" aria-pressed="${read}">${read?'已读':'标为已读'}</button>
     <button class="bookmark-button ${saved?'saved':''}" data-bookmark="${e(p.id)}" aria-label="${saved?'移除':'添加'}本机书签：${e(p.title)}" aria-pressed="${saved}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg></button>
     ${noteButton(p,hasNote)}
     <button class="share-button" data-share="${e(p.id)}" aria-label="分享论文：${e(p.title)}" title="分享论文"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg></button>
     <button class="detail-button" data-paper="${e(p.id)}">阅读导读 →</button>
   </div></div><div class="source-note">${p.sources.map(s=>`<a href="${e(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.label)} ↗</a>`).join(' · ')} · ${e(p.venue)}</div>
 </article>`;
}
export function bilingualDetail(p){
 if(!p.summaryEn)return '';
 return `<div class="detail-english-guide"><span class="metadata-label">English guide · translation of the Chinese guide</span><p lang="en">${e(p.summaryEn)}</p></div>${institutionRow(p)}${authorRow(p)}${figurePanel(p,{detail:true})}${mediaProvenance(p)}`;
}
