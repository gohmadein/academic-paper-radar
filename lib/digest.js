export const PROFILES={xun:{label:'迅',color:'blue',max:8,target:'5–8',description:'机器人全方向（排除纯机构设计）'},li:{label:'李',color:'red',max:3,target:'1–3',description:'VKG / OBDA、视图更新与理论'},lv:{label:'驴',color:'black',max:3,target:'1–3',description:'机器人学习与操作入门'}};
export const STATUS_LABELS={published:'正式发表',accepted:'已录用',preprint:'预印本',workshop:'Workshop',unknown:'发表状态未确认'};
export const DEPTH_LABELS={metadata:'仅元数据',abstract:'摘要级阅读',fulltext:'正文重点核读'};
export const DIFFICULTY_LABELS={beginner:'入门',intermediate:'进阶',advanced:'较难'};
export const READING_LABELS={skim:'建议速读',read:'建议阅读',deep:'建议精读',save:'建议收藏后读'};
const paperKeys=['id','title','titleEn','authors','year','venue','tags','summary','whySelected','sources','demo','profiles','recommendations','identity','publicationStatus','publicationDate','discoveredDate','verifiedAt','readDepth','paperType','classic','novelty','updateNote','links','limits','assumptions','evidence','researchNotes'];
const text=v=>typeof v==='string'&&!!v.trim();
const list=v=>Array.isArray(v)&&v.every(x=>text(x)&&x.length<=10000);
const exact=(obj,allowed)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).every(k=>allowed.includes(k));
const stamp=(v,isDate)=>text(v)&&(isDate(v)||(isDate(v.slice(0,10))&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v))&&/(Z|[+-]\d{2}:\d{2})$/.test(v)));

export function profileCounts(papers){
  return Object.fromEntries(Object.keys(PROFILES).map(id=>[id,{papers:papers.filter(p=>Array.isArray(p?.profiles)&&p.profiles.includes(id)&&!p.classic).length,classics:papers.filter(p=>Array.isArray(p?.profiles)&&p.profiles.includes(id)&&p.classic).length}]));
}

export function validateDigestDay(day,{isDate,safeUrl}){
  const errors=[];
  const fail=(label,msg)=>errors.push(`${label}: ${msg}`);
  if(!exact(day,['version','date','title','demo','timezone','issueNote','coverage','papers'])||day.version!==2||!isDate(day.date)||day.demo!==false||!Array.isArray(day.papers))return ['日报 v2 根结构无效或包含未知字段'];
  if(!text(day.title)||day.title.length>120||day.timezone!=='Asia/Shanghai'||!text(day.issueNote))fail('日报','标题、时区或范围说明无效');
  if(!exact(day.coverage,['checkedSources','limitations'])||!list(day.coverage?.checkedSources)||!list(day.coverage?.limitations))fail('coverage','需要 checkedSources/limitations 文本数组');
  const ids=new Set();
  for(const p of day.papers){
    const id=p?.id||'(无 id)';
    if(!exact(p,paperKeys)||paperKeys.some(k=>!(k in p))){fail(id,'字段缺失或存在未知字段');continue;}
    const profiles=Array.isArray(p.profiles)?p.profiles:[];
    if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(id)||/^(demo-|example-)/.test(id)||ids.has(id))fail(id,'稳定 ID 无效或重复');ids.add(id);
    for(const k of ['title','titleEn','venue','summary','whySelected'])if(!text(p[k])||p[k].length>10000)fail(id,`${k} 需要非空文本`);
    if(typeof p.summary==='string'&&(!/\p{Script=Han}/u.test(p.summary)||[...p.summary].length<100||[...p.summary].length>200))fail(id,'中文导读需要100–200字符');
    for(const k of ['authors','tags','limits','assumptions','researchNotes'])if(!list(p[k])||p[k].length>100)fail(id,`${k} 数组无效`);
    if(!p.authors?.length||!p.tags?.length||p.demo!==false||!Number.isInteger(p.year)||p.year<1800||p.year>2200)fail(id,'作者、标签、年份或真实记录标记无效');
    if(!Array.isArray(p.profiles)||!p.profiles.length||new Set(p.profiles).size!==p.profiles.length||p.profiles.some(k=>!Object.hasOwn(PROFILES,k)))fail(id,'类别需要 xun/li/lv 非空唯一数组');
    if(!exact(p.recommendations,profiles)||profiles.some(k=>!p.recommendations[k]))fail(id,'推荐语必须与类别一一对应');
    else for(const [k,r] of Object.entries(p.recommendations))if(!exact(r,['whyRead','relation','prerequisites','difficulty','readRecommendation'])||!text(r.whyRead)||!text(r.relation)||!list(r.prerequisites)||!Object.hasOwn(DIFFICULTY_LABELS,r.difficulty)||!Object.hasOwn(READING_LABELS,r.readRecommendation))fail(id,`${k} 推荐结构无效`);
    if(!exact(p.identity,['doi','arxiv','other'])||['doi','arxiv','other'].some(k=>p.identity[k]!==null&&!text(p.identity[k]))||!Object.values(p.identity).some(text))fail(id,'至少需要一个可核验的规范身份标识');
    if(p.identity?.doi&&(!/^10\.\d{4,9}\/.+/i.test(p.identity.doi)||/\s/.test(p.identity.doi)))fail(id,'DOI 格式无效');
    if(p.identity?.arxiv&&!/^(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})$/.test(p.identity.arxiv))fail(id,'arXiv 身份需 base ID，不能带版本');
    if(!Object.hasOwn(STATUS_LABELS,p.publicationStatus)||!Object.hasOwn(DEPTH_LABELS,p.readDepth)||!['theory','system','empirical','survey','benchmark'].includes(p.paperType))fail(id,'发表状态、阅读深度或论文类型无效');
    if((p.publicationDate!==null&&!isDate(p.publicationDate))||!isDate(p.discoveredDate)||p.discoveredDate>day.date||!stamp(p.verifiedAt,isDate))fail(id,'日期或核验日期无效');
    if(p.publicationDate&&p.publicationDate>day.date)fail(id,'发表日期不能晚于日报');
    if(!['recent','older-discovery','major-update'].includes(p.novelty)||typeof p.classic!=='boolean'||typeof p.updateNote!=='string')fail(id,'发现类型、经典或更新说明无效');
    if(p.novelty==='major-update'&&!text(p.updateNote))fail(id,'重大更新需要具体变化说明');
    if(p.novelty==='recent'&&(!p.publicationDate||(Date.parse(day.date)-Date.parse(p.publicationDate))/86400000>30))fail(id,'recent 需要最近30日已核验日期；旧文请用 older-discovery');
    if(p.classic&&(new Date(day.date+'T00:00:00Z').getUTCDay()!==1||profiles.includes('xun')))fail(id,'经典仅限周一李/驴栏目');
    if(!exact(p.links,['code','project','video','data'])||['code','project','video','data'].some(k=>p.links[k]!==null&&!safeUrl(p.links[k])))fail(id,'资源必须为核验过的 HTTP(S) 地址或 null');
    if(!Array.isArray(p.sources)||!p.sources.length||p.sources.some(s=>!exact(s,['label','url'])||!text(s.label)||!safeUrl(s.url)))fail(id,'原始来源无效');
    if(!Array.isArray(p.evidence)||!p.evidence.length||p.evidence.some(s=>!exact(s,['url','claim','checkedAt'])||!safeUrl(s.url)||!text(s.claim)||!stamp(s.checkedAt,isDate)))fail(id,'核验依据无效');
    else if(p.links&&Object.values(p.links).some(url=>url&&!p.evidence.some(s=>safeUrl(s.url)===safeUrl(url))))fail(id,'每个资源链接都需独立证据条目，不得补造链接');
  }
  for(const [profile,counts] of Object.entries(profileCounts(day.papers))){if(counts.papers>PROFILES[profile].max)fail(profile,'超出每日数量上限');if(counts.classics>1)fail(profile,'每周一期经典最多一篇');}
  return errors;
}

export function mergeOccurrences(days){
  const found=new Map();
  for(const day of [...days].sort((a,b)=>b.date.localeCompare(a.date)))for(const record of day.papers){
    const p={...record,date:day.date};
    if(!found.has(p.id))found.set(p.id,{...p,issueDates:[day.date],appearances:[p]});
    else{const current=found.get(p.id);current.issueDates.push(day.date);current.appearances.push(p);if(p.profiles){current.profiles=[...new Set([...(current.profiles||[]),...p.profiles])];current.recommendations={...p.recommendations,...current.recommendations};}}
  }
  return [...found.values()];
}
