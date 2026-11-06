import {escapeHTML as e,safeUrl} from './model.js';
import {resolveInstitution} from './institutions.js';

export const ARXIV_BULLETIN_CATEGORIES=Object.freeze(['cs.RO','cs.CV','cs.LG','cs.AI','eess.SY','eess.IV']);
const fields=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const checked=value=>date(value)||(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&date(value.slice(0,10))&&Number.isFinite(Date.parse(value))&&Number(value.slice(11,13))<24&&Number(value.slice(14,16))<60&&Number(value.slice(17,19))<60);
const text=value=>typeof value==='string'&&value.trim().length>0;
const strings=value=>Array.isArray(value)&&value.every(text);
const unique=value=>new Set(value).size===value.length;
const integer=value=>Number.isSafeInteger(value)&&value>=0;
function requireThat(condition,message){if(!condition)throw new Error(`arXiv 日报：${message}`);}

// Validate the complete supplied bulletin; never silently truncate records or coverage.
export function validateArxivBulletin(data){
 requireThat(fields(data,['version','date','announcementDate','checkedAt','status','coverage','entries']),'根格式无效');
 requireThat(data.version===1&&date(data.date)&&(data.announcementDate===null||date(data.announcementDate))&&checked(data.checkedAt),'版本或日期无效');
 requireThat(['complete','partial','unavailable'].includes(data.status),'核验状态无效');
 const c=data.coverage;
 requireThat(fields(c,['checkedCategories','checkedCount','includedCount','limitations','categoryStatus']),'覆盖记录无效');
 requireThat(Array.isArray(c.checkedCategories)&&unique(c.checkedCategories)&&c.checkedCategories.every(category=>ARXIV_BULLETIN_CATEGORIES.includes(category)),'核验分类无效');
 requireThat((c.checkedCount===null||integer(c.checkedCount))&&integer(c.includedCount)&&strings(c.limitations),'核验数量或限制无效');
 requireThat(Array.isArray(c.categoryStatus)&&c.categoryStatus.length===6&&unique(c.categoryStatus.map(row=>row?.category)),'逐分类核验记录必须包含六个分类');
 for(const row of c.categoryStatus){
  requireThat(fields(row,['category','status','announcementDate','listedCount','checkedCount','sourceUrl'])&&ARXIV_BULLETIN_CATEGORIES.includes(row.category)&&['complete','partial','unavailable'].includes(row.status)&&(row.announcementDate===null||date(row.announcementDate))&&(row.listedCount===null||integer(row.listedCount))&&integer(row.checkedCount)&&(row.listedCount===null||row.checkedCount<=row.listedCount),'逐分类核验记录无效');
  let source;try{source=new URL(row.sourceUrl);}catch{}
  requireThat(typeof row.sourceUrl==='string'&&source?.protocol==='https:'&&['arxiv.org','www.arxiv.org','export.arxiv.org'].includes(source.hostname)&&!source.username&&!source.password&&!source.port,'分类来源必须为官方 arXiv HTTPS');
  if(row.status==='complete')requireThat(row.listedCount!==null&&row.checkedCount===row.listedCount,'分类完整核验数量不一致');
  if(row.status==='unavailable')requireThat(row.checkedCount===0,'不可用分类不得声明已核验');
  requireThat(c.checkedCategories.includes(row.category)===(row.status==='complete'||row.checkedCount>0),'已核验分类与逐分类记录不一致');
 }
 if(data.status==='complete')requireThat(data.announcementDate!==null&&c.categoryStatus.every(row=>row.status==='complete'&&row.announcementDate===data.announcementDate),'完整状态需要全部分类公告日期一致');
 if(data.status==='unavailable')requireThat(c.categoryStatus.every(row=>row.status==='unavailable'),'不可用状态必须与逐分类记录一致');
 requireThat(Array.isArray(data.entries)&&data.entries.length===c.includedCount&&(c.checkedCount===null||c.checkedCount>=c.includedCount),'条目数量与覆盖记录不一致');
 if(c.checkedCount!==null)requireThat(c.checkedCount===c.categoryStatus.reduce((sum,row)=>sum+row.checkedCount,0),'核验总量与分类记录不一致');
 if(data.status==='complete')requireThat(c.checkedCategories.length===ARXIV_BULLETIN_CATEGORIES.length&&c.checkedCount!==null,'完整状态必须核验全部分类并提供数量');
 if(data.status==='partial')requireThat(c.limitations.length>0,'部分核验必须说明限制');
 if(data.status==='unavailable')requireThat(!data.entries.length&&c.checkedCount===null&&!c.checkedCategories.length&&c.limitations.length>0,'不可用状态不得声明已核验论文');
 const seen=new Set();
 for(const entry of data.entries){
  requireThat(fields(entry,['id','arxivId','version','titleEn','titleZh','authors','publishedDate','updatedDate','change','categories','url','topics','announcements',...(Object.hasOwn(entry||{},'guide')?['guide']:[]),...(Object.hasOwn(entry||{},'affiliations')?['affiliations','affiliationVerification']:[])]),'论文格式无效');
  requireThat(typeof entry.arxivId==='string'&&/^\d{2}(?:0[1-9]|1[0-2])\.\d{4,5}$/.test(entry.arxivId)&&entry.id==='arxiv-'+entry.arxivId.replace('.','-')&&!seen.has(entry.arxivId),'论文标识无效或重复');
  seen.add(entry.arxivId);
  requireThat(entry.version===null||(Number.isSafeInteger(entry.version)&&entry.version>=1),'论文版本无效');
  requireThat(entry.url===`https://arxiv.org/abs/${entry.arxivId}`||(entry.version!==null&&entry.url===`https://arxiv.org/abs/${entry.arxivId}v${entry.version}`),'论文链接不是对应官方版本');
  requireThat(text(entry.titleEn)&&(entry.titleZh===null||text(entry.titleZh))&&strings(entry.authors)&&entry.authors.length>0&&strings(entry.topics),'标题、作者或主题无效');
  requireThat((entry.publishedDate===null||date(entry.publishedDate))&&(entry.updatedDate===null||date(entry.updatedDate))&&(!entry.publishedDate||!entry.updatedDate||entry.publishedDate<=entry.updatedDate),'论文日期无效');
  requireThat(['new','revised','cross-list'].includes(entry.change),'更新类型无效');
  requireThat(Array.isArray(entry.announcements)&&entry.announcements.length>0&&unique(entry.announcements.map(row=>row?.category))&&entry.announcements.every(row=>fields(row,['category','change'])&&ARXIV_BULLETIN_CATEGORIES.includes(row.category)&&Array.isArray(entry.categories)&&entry.categories.includes(row.category)&&['new','revised','cross-list'].includes(row.change)),'逐分类公告记录无效');
  const priority=['new','revised','cross-list'];
  requireThat(entry.change===priority.find(change=>entry.announcements.some(row=>row.change===change)),'汇总更新类型与逐分类公告不一致');
  requireThat(strings(entry.categories)&&entry.categories.length>0&&unique(entry.categories)&&entry.categories.every(category=>/^[a-z][a-z-]*(?:\.[A-Z][A-Z0-9-]*)?$/.test(category)),'论文分类无效');
  if(Object.hasOwn(entry,'guide'))validateGuide(entry);
  if(Object.hasOwn(entry,'affiliations'))validateAffiliations(entry);
 }
 return data;
}


function validateAffiliations(entry){
 const rows=entry.affiliations,v=entry.affiliationVerification;
 requireThat(Array.isArray(rows)&&rows.length<=100&&unique(rows.map(row=>row?.institutionId)),'署名机构数组或ID无效');
 requireThat(fields(v,['status','checkedAt','note'])&&['complete','partial','unavailable'].includes(v.status)&&checked(v.checkedAt)&&text(v.note),'署名核验状态无效');
 requireThat(v.status!=='complete'||rows.length>0,'完整署名核验不能没有机构');
 requireThat(v.status!=='unavailable'||rows.length===0,'无法核验不能声明机构');
 for(const row of rows){
  requireThat(fields(row,['institutionId','name','institutionType','authorNames','evidence','note'])&&/^[a-z0-9][a-z0-9-]{0,99}$/.test(row.institutionId)&&text(row.name)&&['university','research-institute','company','chair'].includes(row.institutionType)&&strings(row.authorNames)&&unique(row.authorNames)&&row.authorNames.every(name=>entry.authors.includes(name))&&text(row.note),'署名机构、作者对应或说明无效');
  requireThat(Array.isArray(row.evidence)&&row.evidence.length>0&&row.evidence.every(item=>fields(item,['url','claim','checkedAt'])&&safeUrl(item.url)&&text(item.claim)&&checked(item.checkedAt)),'署名机构缺少论文证据');
 }
}
export function validateArxivInstitutions(data,registry){
 const errors=[];
 for(const entry of data.entries||[])for(const row of entry.affiliations||[]){
  const record=registry?.institutions?.find(i=>i.id===row.institutionId),named=registry?.institutions?resolveInstitution(registry,row.name):null;
  if(!record||named?.id!==record.id||record.institutionType!==row.institutionType)errors.push(`${entry.id}: 署名机构与机构库不一致：${row.name}`);
 }
 return errors;
}
function affiliationVisuals(entry,registry){
 if(!entry.affiliations)return undefined;
 return {mainFigure:null,figureNote:'arXiv公告不展示论文主图。',authors:[],institutions:entry.affiliations.map(row=>{
  const named=registry?.institutions?resolveInstitution(registry,row.name):null;
  const record=registry?.institutions?.find(i=>i.id===row.institutionId&&named?.id===i.id&&i.institutionType===row.institutionType);
  return {...row,logo:record?.logo?structuredClone(record.logo):null,markType:record?.markType||'none'};
 })};
}

function validateGuide(entry){
 const g=entry.guide;
 requireThat(fields(g,['titleZh','summaryZh','summaryEn','whyRead','relation','prerequisites','difficulty','readRecommendation','tags','limits','assumptions','readingAdvice','links','evidence']),'导读字段无效');
 for(const key of ['titleZh','summaryZh','summaryEn','whyRead','relation'])requireThat(text(g[key])&&g[key].length<=10000,'导读文本无效');
 requireThat(/\p{Script=Han}/u.test(g.summaryZh)&&[...g.summaryZh].length>=100&&[...g.summaryZh].length<=200,'中文导读需要100–200字符');
 requireThat(g.summaryEn.length>=40&&g.summaryEn.length<=5000&&/[a-zA-Z]/.test(g.summaryEn),'英文导读需要对应翻译');
 for(const key of ['prerequisites','tags','limits','assumptions','readingAdvice'])requireThat(strings(g[key])&&g[key].length<=100&&g[key].every(value=>value.length<=10000),'导读列表无效');
 requireThat(g.tags.length>0&&['beginner','intermediate','advanced'].includes(g.difficulty)&&['skim','read','deep','save'].includes(g.readRecommendation),'导读难度、建议或标签无效');
 requireThat(fields(g.links,['code','project','video','data'])&&Object.values(g.links).every(url=>url===null||safeUrl(url)),'导读资源链接无效');
 requireThat(Array.isArray(g.evidence)&&g.evidence.length>0&&g.evidence.length<=100&&g.evidence.every(row=>fields(row,['url','claim','checkedAt'])&&safeUrl(row.url)&&text(row.claim)&&checked(row.checkedAt)),'导读证据无效');
 requireThat(g.evidence.some(row=>row.url===`https://arxiv.org/abs/${entry.arxivId}`||(entry.version!==null&&row.url===`https://arxiv.org/abs/${entry.arxivId}v${entry.version}`)),'导读缺少本论文官方摘要证据');
 requireThat(Object.values(g.links).every(url=>url===null||g.evidence.some(row=>safeUrl(row.url)===safeUrl(url))),'每个资源链接需要对应证据');
}

export function bulletinPapers(data,registry=null){
 validateArxivBulletin(data);
 return data.entries.filter(entry=>entry.guide).map(entry=>{
  const g=entry.guide,version=entry.version===null?'':`v${entry.version}`,base=`https://arxiv.org/abs/${entry.arxivId}${version}`;
  return {id:entry.id,...(entry.affiliations?{visuals:affiliationVisuals(entry,registry),affiliationVerification:entry.affiliationVerification}:{}),bulletin:true,bulletinChange:entry.change,arxivVersion:entry.version,arxivUpdatedDate:entry.updatedDate,date:data.date,title:g.titleZh,titleEn:entry.titleEn,authors:[...entry.authors],year:Number((entry.publishedDate||data.date).slice(0,4)),venue:'arXiv',tags:[...g.tags],summary:g.summaryZh,summaryEn:g.summaryEn,whySelected:g.whyRead,sources:[{label:'arXiv',url:base},{label:'PDF',url:`https://arxiv.org/pdf/${entry.arxivId}${version}`}],demo:false,profiles:['xun'],recommendations:{xun:{whyRead:g.whyRead,relation:g.relation,prerequisites:[...g.prerequisites],difficulty:g.difficulty,readRecommendation:g.readRecommendation}},identity:{doi:null,arxiv:entry.arxivId,other:null},publicationStatus:'preprint',publicationDate:entry.publishedDate,discoveredDate:data.date,verifiedAt:data.checkedAt,readDepth:'abstract',paperType:null,classic:false,novelty:entry.publishedDate&&(Date.parse(data.date)-Date.parse(entry.publishedDate))/86400000<=30?'recent':'older-discovery',updateNote:'',links:{...g.links},limits:[...g.limits],assumptions:[...g.assumptions],evidence:g.evidence.map(row=>({...row})),researchNotes:['摘要级阅读：导读依据作者摘要与所列证据，未进行正文逐节核验或独立复现。',...g.readingAdvice]};
 });
}

export function bulletinHTML(data=null,renderCard,registry=null){
 try{validateArxivBulletin(data);}catch{data=null;}
 if(!data)return '<details class="arxiv-bulletin"><summary>每日 arXiv 更新</summary><div class="arxiv-bulletin-body" tabindex="0" aria-label="arXiv公告列表，可滚动"><p class="arxiv-bulletin-status">日报暂不可用，未能确认今日更新。</p></div></details>';
 const c=data.coverage,status=data.status==='complete'?'已核验关注分类':data.status==='partial'?'部分核验':'核验暂不可用';
 const count=data.status==='unavailable'?'未确认':`${c.includedCount} 篇`;
 const coverage=data.status==='unavailable'?'':`<p class="arxiv-bulletin-coverage">${c.checkedCount===null?'检索总量未确认':`核验 ${c.checkedCount} 条分类记录`} · 收录 ${c.includedCount} 篇${c.checkedCategories.length?` · ${e(c.checkedCategories.join(' / '))}`:''}</p>`;
 const guided=typeof renderCard==='function'?new Map(bulletinPapers(data,registry).map(p=>[p.id,p])):new Map();
 const entries=data.entries.map((entry,index)=>{
  if(guided.has(entry.id))return `<li class="arxiv-bulletin-item arxiv-bulletin-guided">${renderCard(guided.get(entry.id),index)}</li>`;
  const authors=entry.authors.slice(0,3).join('、')+(entry.authors.length>3?` 等 ${entry.authors.length} 人`:'');
  return `<li class="arxiv-bulletin-item"><a href="${e(entry.url)}" target="_blank" rel="noopener noreferrer">${entry.titleZh?`<span lang="zh">${e(entry.titleZh)}</span><br>`:''}<span lang="en">${e(entry.titleEn)}</span></a><p class="arxiv-bulletin-meta" title="${e(entry.announcements.map(row=>row.category+': '+({new:'新提交',revised:'修订','cross-list':'跨分类'}[row.change])).join(' / '))}"><span>预印本</span> · <span>${{new:'新提交',revised:'修订', 'cross-list':'跨分类'}[entry.change]}</span>${entry.version===null?' · 版本未核实':` · v${entry.version}`} · ${entry.updatedDate?e(entry.updatedDate):'更新日期未核实'}</p><p class="arxiv-bulletin-authors" title="${e(entry.authors.join('、'))}">${e(authors)}</p><p class="arxiv-bulletin-topics">${e(entry.categories.join(' / '))}${entry.topics.length?' · '+e(entry.topics.join(' / ')):''}</p>${!entry.guide?'<p class="arxiv-bulletin-meta">中文导读待补齐</p>':''}</li>`;
 }).join('');
 return `<details class="arxiv-bulletin"><summary>每日 arXiv 更新 <span>${e(data.date)} · ${count}</span></summary><div class="arxiv-bulletin-body" tabindex="0" aria-label="arXiv公告列表，可滚动"><p class="arxiv-bulletin-status">${status} · 核验 ${e(data.checkedAt)}${data.announcementDate?` · 公告 ${e(data.announcementDate)}`:' · 公告日期未确认'}</p>${coverage}${c.limitations.length?`<ul class="arxiv-bulletin-limitations">${c.limitations.map(item=>`<li>${e(item)}</li>`).join('')}</ul>`:''}${entries?`<ul class="arxiv-bulletin-list">${entries}</ul>`:data.status==='complete'?'<p>本次核验未收录相关更新。</p>':''}</div></details>`;
}
