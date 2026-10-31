import {safeUrl,escapeHTML as e} from './model.js';
const validPath=p=>typeof p==='string'&&/^assets\/(?:papers|institutions|authors)\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|svg)$/.test(p)&&!p.split('/').includes('..');
export const assetURL=asset=>asset&&validPath(asset.path)&&typeof asset.sha256==='string'&&/^[a-f0-9]{64}$/.test(asset.sha256)?`./${asset.path}?v=${asset.sha256.slice(0,12)}`:null;
export function initials(name){const parts=String(name).trim().split(/\s+/);return parts.length>1?(parts[0][0]+parts.at(-1)[0]).toUpperCase():[...parts[0]].slice(0,2).join('');}
const stamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v);
export function validateAsset(asset,kind){
 if(!asset||typeof asset!=='object'||Array.isArray(asset))return ['素材结构无效'];
 const keys=['kind','path','sha256','width','height','sourceUrl','evidenceUrl','verifiedAt','credit','rights','displayPolicy','background','altZh','altEn'];
 const errors=[];
 if(Object.keys(asset).some(k=>!keys.includes(k))||keys.some(k=>!(k in asset)))errors.push('素材字段缺失或有未知字段');
 if(asset.kind!==kind||!['figure','institution-logo','author-portrait'].includes(asset.kind)||!assetURL(asset))errors.push('素材类型、本地路径或SHA256无效');
 if(!Number.isInteger(asset.width)||!Number.isInteger(asset.height)||asset.width<1||asset.height<1||asset.width>20000||asset.height>20000)errors.push('素材尺寸无效');
 if(!safeUrl(asset.sourceUrl)||!safeUrl(asset.evidenceUrl)||!stamp(asset.verifiedAt))errors.push('素材来源或核验日期无效');
 for(const k of ['credit','rights','altZh','altEn'])if(typeof asset[k]!=='string'||!asset[k].trim()||asset[k].length>5000)errors.push(`${k} 需要真实非空说明`);
 if(!['open-license','official-brand','attributed-thumbnail'].includes(asset.displayPolicy)||!['light','dark','transparent'].includes(asset.background))errors.push('素材展示策略无效，受限标志必须使用文字回退而非引用文件');
 if(kind==='author-portrait'&&asset.displayPolicy==='official-brand')errors.push('机构品牌许可不能用作作者肖像证明');
 return errors;
}
export function validateVisuals(p){
 const v=p.visuals,errors=[];
 const authorNames=Array.isArray(p.authors)?p.authors:[];
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['mainFigure','figureNote','institutions','authors'].includes(k))||!('mainFigure'in v)||typeof v.figureNote!=='string'||!Array.isArray(v.institutions)||!Array.isArray(v.authors))return ['visuals 结构无效'];
 if(v.mainFigure)errors.push(...validateAsset(v.mainFigure,'figure'));
 else if(!v.figureNote.trim())errors.push('无主图时需诚实说明');
 for(const inst of v.institutions){
  if(!inst||Object.keys(inst).some(k=>!['name','logo','authorNames','evidence','note','institutionType','markType','institutionId'].includes(k))||typeof inst.name!=='string'||!inst.name.trim()||!('logo'in inst)||typeof inst.note!=='string'||!Array.isArray(inst.authorNames)||inst.authorNames.some(n=>!authorNames.includes(n))||!Array.isArray(inst.evidence)||!inst.evidence.length||inst.evidence.some(s=>!s||Object.keys(s).some(k=>!['url','claim','checkedAt'].includes(k))||!safeUrl(s.url)||typeof s.claim!=='string'||!s.claim.trim()||!stamp(s.checkedAt)))errors.push('机构必须有论文署名证据，不能从当前雇主猜测');
  if(!['university','research-institute','company','chair'].includes(inst?.institutionType)||!(inst?.institutionType==='university'?['emblem','compact-symbol','none']:['organization-mark','none']).includes(inst?.markType)||Boolean(inst?.logo)!==(inst?.markType!=='none'))errors.push('大学只用完整官方校徽或紧凑身份符号，机构用自身标识；缺失时仅显示名称');
  if(inst?.logo)errors.push(...validateAsset(inst.logo,'institution-logo'));
 }
 const names=new Set();
 for(const author of v.authors){
  if(!author||Object.keys(author).some(k=>!['name','portrait','note'].includes(k))||!authorNames.includes(author.name)||names.has(author.name)||!('portrait'in author)||typeof author.note!=='string')errors.push('作者肖像必须对应原始作者名单，不能把机构标志当人像');
  if(author?.portrait)errors.push(...validateAsset(author.portrait,'author-portrait'));
  names.add(author?.name);
 }
 return errors;
}
export function collectAssets(p){
 const v=p.visuals;if(!v)return [];
 return [v.mainFigure,...(Array.isArray(v.institutions)?v.institutions:[]).map(x=>x?.logo),...(Array.isArray(v.authors)?v.authors:[]).map(x=>x?.portrait)].filter(Boolean);
}
function avatar(name,asset,kind){
 const url=assetURL(asset);if(!url)return '';
 const minWidth=asset.path==='assets/institutions/asu-vertical.png'?48:32;
 const width=kind==='institution-avatar'?Math.round(Math.min(64,Math.max(minWidth,32*asset.width/asset.height))):null;
 const height=width?(minWidth===48?Math.ceil(width*asset.height/asset.width):32):null;
 return `<span class="media-avatar ${kind}"${width?` style="width:${width}px;height:${height}px"`:``}><img src="${e(url)}" width="${asset.width}" height="${asset.height}" alt="${e(asset.altZh)}" loading="lazy" decoding="async" data-media-image></span>`;
}
export function institutionRow(p){
 const institutions=p.visuals?.institutions||[];
 return `<div class="paper-institutions"><span class="metadata-label">论文署名机构</span>${institutions.length?institutions.map(i=>`<span class="institution-item">${avatar(i.name,i.logo,'institution-avatar')}<span>${e(i.name)}</span></span>`).join(''):'<span class="metadata-unavailable">机构信息暂未核实</span>'}</div>`;
}
export function authorRow(p){
 const authors=p.authors.map(name=>{const found=p.visuals?.authors?.find(a=>a.name===name);return `<span class="author-item">${avatar(name,found?.portrait,'author-avatar')}<span>${e(name)}</span></span>`;});
 return `<div class="paper-authors" aria-label="论文完整作者名单"><span class="metadata-label">作者</span>${authors.slice(0,3).join('')}${authors.length>3?`<details class="more-authors"><summary>另 ${authors.length-3} 位作者</summary><div>${authors.slice(3).join('')}</div></details>`:''}</div>`;
}
export function figurePanel(p,{detail=false}={}){
 const asset=p.visuals?.mainFigure,url=assetURL(asset);
 return `<figure class="paper-figure ${detail?'detail-figure':''}"><div class="figure-frame">${url?`<a href="${e(url)}" target="_blank" rel="noopener noreferrer" aria-label="打开主图：${e(p.title)}（新标签页）"><img src="${e(url)}" alt="${e(asset.altZh)}" width="${asset.width}" height="${asset.height}" loading="lazy" decoding="async" data-media-image></a>`:''}<div class="figure-fallback" ${url?'hidden':''}><span aria-hidden="true">▧</span><strong>${url?'主图暂时无法载入':'暂无可核实主图'}</strong><p>${e(p.visuals?.figureNote||(p.demo?'演示条目不提供真实论文图片。':'已核验主图暂不可用，可查看原始来源。'))}</p></div></div>${url?`<figcaption><span>${e(asset.credit)}</span><a href="${e(safeUrl(asset.sourceUrl))}" target="_blank" rel="noopener noreferrer">图源 ↗</a></figcaption>`:''}</figure>`;
}
export function mediaProvenance(p){
 if(!p.visuals)return '';
 const assets=collectAssets(p);
 return `<details class="media-provenance"><summary>图像与署名来源</summary><p>图像为论文或作者/机构公开材料的署名展示，不代表机构背书。</p>${p.visuals.institutions.map(i=>`<p><strong>${e(i.name)}</strong>：${e(i.note)} ${i.evidence.map(s=>`<a href="${e(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${e(s.claim)} ↗</a>`).join(' · ')}</p>`).join('')}<ul>${assets.map(a=>`<li>${e(a.credit)} · ${e(a.rights)} <a href="${e(safeUrl(a.evidenceUrl))}" target="_blank" rel="noopener noreferrer">核验出处 ↗</a></li>`).join('')}</ul></details>`;
}
export function handleMediaError(image){
 const figure=image.closest('.figure-frame');
 if(figure){image.hidden=true;const link=image.closest('a');if(link)link.hidden=true;const fallback=figure.querySelector('.figure-fallback');if(fallback)fallback.hidden=false;return;}
 const avatar=image.closest('.media-avatar');if(avatar)avatar.hidden=true;
}
