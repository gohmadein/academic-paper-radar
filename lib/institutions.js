import {institutionMarkClass,institutionMarkLink} from './institution-display.js';
import {assetURL,validateAsset} from './paper-media.js';
import {escapeHTML as e,safeUrl} from './model.js';
export const institutionKey=name=>String(name).normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g,' ');
export function resolveInstitution(registry,name){return registry.institutions.find(i=>[i.officialName,...i.aliases].some(a=>institutionKey(a)===institutionKey(name)));}
export function validateInstitutions(registry,papers=[]){
 const errors=[];if(registry?.version!==1||!Array.isArray(registry.institutions))return ['机构库结构无效'];
 const ids=new Set(),aliases=new Map(),paths=new Map(),hashes=new Map();
 for(const i of registry.institutions){
  if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(i.id)||ids.has(i.id))errors.push('机构库ID重复或无效');ids.add(i.id);
  if(typeof i.officialName!=='string'||!i.officialName.trim()||!Array.isArray(i.aliases)||i.aliases.some(a=>typeof a!=='string'||!a.trim())){errors.push('机构库名称或别名无效');continue;}
  for(const name of [i.officialName,...i.aliases]){const key=institutionKey(name);if(aliases.has(key)&&aliases.get(key)!==i.id)errors.push(`机构库别名冲突：${name}`);aliases.set(key,i.id);}
  if(!['university','research-institute','company','chair'].includes(i.institutionType)||!(i.institutionType==='university'?['emblem','compact-symbol','wordmark','none']:['organization-mark','none']).includes(i.markType))errors.push(`${i.id}: 标识类型不符`);
  if(!['verified','needs-verification','unavailable'].includes(i.status)||Boolean(i.logo)!==(i.markType!=='none')||Boolean(i.logo)!==(i.status==='verified'))errors.push(`${i.id}: 标识核验状态不符`);
  if(i.rightsStatus!==undefined&&(i.rightsStatus!=='not-separately-authorized'||i.displayScope!=='paper-affiliation-only'||!i.logo||!safeUrl(i.rightsPolicyUrl)))errors.push(`${i.id}: 未另行授权的素材必须限定论文署名用途并保留官方权利条款`);
  if(i.displayScope!==undefined&&i.displayScope!=='paper-affiliation-only')errors.push(`${i.id}: 标识展示范围无效`);
  if(!['transparent','opaque-light','opaque-dark','not-applicable'].includes(i.alphaStatus)||!i.note?.trim())errors.push(`${i.id}: 缺少背景状态或说明`);
  if(i.logo){errors.push(...validateAsset(i.logo,'institution-logo'));const a=i.logo;if(paths.has(a.path)&&paths.get(a.path)!==a.sha256)errors.push('机构库路径哈希冲突');if(hashes.has(a.sha256)&&hashes.get(a.sha256)!==a.path)errors.push('机构库重复文件');paths.set(a.path,a.sha256);hashes.set(a.sha256,a.path);if(i.alphaStatus==='not-applicable'||(a.background==='transparent')!==(i.alphaStatus==='transparent'))errors.push(`${i.id}: 背景声明冲突`);}
 }
 for(const p of papers)for(const i of p.visuals?.institutions||[]){const record=resolveInstitution(registry,i.name);if(!record||i.institutionId!==record.id||i.institutionType!==record.institutionType||i.markType!==record.markType||JSON.stringify(i.logo)!==JSON.stringify(record.logo))errors.push(`${p.id}: 机构引用与库不一致：${i.name}`);}
 return errors;
}
// Resolving an institution never creates or replaces paper/author affiliation evidence.
export function reuseInstitutions(papers,registry){
 for(const p of papers)for(const i of p.visuals?.institutions||[]){
  let record=resolveInstitution(registry,i.name);
  if(!record){let id='pending-'+institutionKey(i.name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70);if(id==='pending-')id+='institution';const stem=id;let n=2;while(registry.institutions.some(r=>r.id===id))id=stem+'-'+n++;
   record={id,officialName:i.name,aliases:[],institutionType:i.institutionType,markType:'none',status:'needs-verification',alphaStatus:'not-applicable',logo:null,note:'新机构等待官方标识与使用条件核验；不接受未经核验的输入图片。'};registry.institutions.push(record);
  }
  i.institutionId=record.id;i.institutionType=record.institutionType;i.markType=record.markType;i.logo=structuredClone(record.logo);
 }
 return registry;
}
export function galleryInstitutions(papers,registry){const found=new Map();for(const p of papers)for(const i of p.visuals?.institutions||[]){const r=resolveInstitution(registry,i.name);if(r)found.set(r.id,r);}return [...found.values()];}
export function institutionGallery(papers,registry){
 const records=galleryInstitutions(papers,registry);if(!records.length)return '';
 return `<section class="institution-library" aria-labelledby="institution-library-title"><div class="institution-library-heading"><div><p class="eyebrow">AFFILIATION MARK LIBRARY</p><h2 id="institution-library-title">署名机构 · 标识库 <span>${records.length}</span></h2></div><div class="institution-library-controls"><button type="button" data-institution-scroll="-1" aria-controls="institution-strip" aria-label="向左浏览署名机构">←</button><button type="button" data-institution-scroll="1" aria-controls="institution-strip" aria-label="向右浏览署名机构">→</button></div></div><ul id="institution-strip" class="institution-strip" tabindex="0" aria-label="论文署名机构标识，使用左右方向键浏览">${records.map(i=>{const paperOnly=i.displayScope==='paper-affiliation-only',url=paperOnly?null:assetURL(i.logo),link=safeUrl(institutionMarkLink(i.logo)),tag=link?'a':'span';return `<li class="institution-library-card">${url?`<${tag}${link?` href="${e(link)}" target="_blank" rel="noopener noreferrer" aria-label="${e(i.officialName)} 官方网站（新标签页）"`:``} class="media-avatar institution-library-mark ${institutionMarkClass(i.logo)}"><img src="${e(url)}" width="${i.logo.width}" height="${i.logo.height}" alt="${e(i.logo.altZh)}" loading="lazy" decoding="async" data-media-image></${tag}>`:''}<strong>${e(i.officialName)}</strong><details><summary>${url?'标识来源':paperOnly?'标识用途':'核验状态'}</summary><p>${e(i.note)}</p>${i.logo?`${paperOnly?'<p>标识仅用于具体论文署名说明，此处保留机构名称。</p>':''}<p>${e(i.logo.rights)}</p><a href="${e(safeUrl(i.logo.evidenceUrl))}" target="_blank" rel="noopener noreferrer">官方来源 ↗</a>`:'<p>标识待核验，暂仅列出已核实的署名机构名称。</p>'}</details></li>`;}).join('')}</ul></section>`;
}
export function scrollInstitutions(strip,direction){if(strip)strip.scrollBy({left:direction*Math.max(180,strip.clientWidth*.8),behavior:'instant'});}
export function institutionKeydown(event,strip){if(event.target!==strip)return;const direction={ArrowLeft:-1,ArrowRight:1}[event.key];if(direction){event.preventDefault();scrollInstitutions(strip,direction);}else if(event.key==='Home'||event.key==='End'){event.preventDefault();strip.scrollTo({left:event.key==='Home'?0:strip.scrollWidth,behavior:'instant'});}}
