import {institutionDisplayRules} from './institution-display-rules.js';
// Asset-keyed external CSS: never depend on CSP-blocked inline style attributes.
export const institutionMarkClass=asset=>/^[a-f0-9]{64}$/.test(asset?.sha256||'')?`institution-mark-${asset.sha256.slice(0,16)}`:'';
export function markDimensions(asset,constraint={}){
 const ratio=asset.width/asset.height;
 const width=constraint.imageWidthPx??Math.ceil(Math.min(128,Math.max(1,32*ratio)));
 const height=constraint.imageHeightPx??Math.min(32,Math.ceil(width/ratio));
 const padding=constraint.paddingPx??0;
 return {width,height,padding,outerWidth:width+2*padding,outerHeight:height+2*padding};
}
export function validateInstitutionDisplay(registry,config=institutionDisplayRules){
 const errors=[];if(config?.version!==1||!config.marks||typeof config.marks!=='object')return ['标识展示规则结构无效'];
 for(const [path,c] of Object.entries(config.marks)){
  const asset=registry.institutions.find(i=>i.logo?.path===path)?.logo;
  if(!asset){errors.push(`${path}: 展示规则没有已核验素材`);continue;}
  if(c.linkUrl!==undefined&&!/^https:\/\/[^\s<>]+$/.test(c.linkUrl))errors.push(`${path}: 标识官方链接无效`);
  for(const k of ['imageWidthPx','imageHeightPx','paddingPx'])if(!Number.isInteger(c[k])||c[k]<(k==='paddingPx'?0:1))errors.push(`${path}: ${k}无效`);
  const d=markDimensions(asset,c);if(d.outerWidth>512||d.outerHeight>512||Math.abs((d.width/d.height)/(asset.width/asset.height)-1)>.03)errors.push(`${path}: 尺寸失真或超出移动卡片安全范围`);
  if(!(['transparent','white'].includes(c.background)||/^#[a-fA-F0-9]{6}$/.test(c.background))||!/^https:\/\//.test(c.evidenceUrl||'')||!c.note?.trim())errors.push(`${path}: 缺少展示条件证据`);
  if(c.visibleBounds){const [x,y,w,h]=c.visibleBounds;if(![x,y,w,h].every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>asset.width||y+h>asset.height)errors.push(`${path}: 原生标识边界无效`);else {const scale=Math.min(d.width/asset.width,d.height/asset.height);if((c.minVisibleWidthPx&&w*scale<c.minVisibleWidthPx)||(c.minVisibleHeightPx&&h*scale<c.minVisibleHeightPx))errors.push(`${path}: 实际标识小于官方最小尺寸`);if(c.minClearSpacePx&&Math.min(x,y,asset.width-x-w,asset.height-y-h)*scale+d.padding<c.minClearSpacePx)errors.push(`${path}: 标识安全留白不足`);}}
 }
 return errors;
}
export function institutionDisplayCSS(registry,config=institutionDisplayRules){
 const errors=validateInstitutionDisplay(registry,config);if(errors.length)throw Error(errors.join('\n'));
 return '\n/* Generated from verified institution assets and reviewed display constraints. */\n'+registry.institutions.filter(i=>i.logo).map(i=>{
  const a=i.logo,c=config.marks[a.path],d=markDimensions(a,c),cls=institutionMarkClass(a);
  const selectors=[`.institution-avatar.${cls}`,...(c?[`.institution-library-mark.${cls}`]:[])].join(',');
  const large=d.outerWidth>160||d.outerHeight>100;
  return `${selectors}{width:${d.outerWidth}px;height:${d.outerHeight}px;flex:0 0 auto;padding:${d.padding}px;background:${c?.background==='white'?'#fff':c?.background||'transparent'};border:0;border-radius:0;box-shadow:none}${c&&large?`.institution-library-card:has(.${cls}){flex-basis:${d.outerWidth+26}px;min-width:${d.outerWidth+26}px}`:''}`;
 }).join('\n')+'\n';
}

export function institutionMarkNeedsOwnRow(asset){const c=institutionDisplayRules.marks[asset?.path];if(!c)return false;const d=markDimensions(asset,c);return d.outerWidth>160||d.outerHeight>100;}

export function institutionMarkLink(asset){return institutionDisplayRules.marks[asset?.path]?.linkUrl||null;}
