import {createHash} from 'node:crypto';
export function normalizeIdentity(value={}){
  const clean=x=>typeof x==='string'&&x.trim()?x.trim():null;
  let doi=clean(value.doi),arxiv=clean(value.arxiv);
  if(doi)doi=doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:/i,'').toLowerCase();
  if(arxiv)arxiv=arxiv.replace(/^https?:\/\/arxiv\.org\/(?:abs|pdf)\//i,'').replace(/^arxiv:/i,'').replace(/\.pdf$/,'').replace(/v\d+$/,'');
  return {doi,arxiv,other:clean(value.other)};
}
export const aliasesFor=identity=>Object.entries(normalizeIdentity(identity)).filter(([,v])=>v).map(([k,v])=>`${k}:${v}`).sort();
export function deriveID(identity){
  const i=normalizeIdentity(identity);
  if(i.arxiv)return 'arxiv-'+i.arxiv.toLowerCase().replace(/[^a-z0-9-]/g,'-');
  const alias=aliasesFor(i)[0];if(!alias)throw new Error('论文缺少规范标识');
  return (i.doi?'doi-':'paper-')+createHash('sha256').update(i.doi||alias).digest('hex').slice(0,20);
}
export function normalizePapers(papers,registry){
  const owners=new Map();
  for(const record of registry.papers)for(const alias of record.aliases){if(owners.has(alias)&&owners.get(alias)!==record.id)throw new Error('身份别名冲突，需要人工核对');owners.set(alias,record.id);}
  const found=new Map();
  for(const raw of papers){
    const identity=normalizeIdentity(raw.identity);
    const aliases=aliasesFor(identity);
    const known=[...new Set(aliases.map(a=>owners.get(a)).filter(Boolean))];
    if(known.length>1)throw new Error('同一输入指向多个历史ID，禁止自动合并以免丢失书签');
    const id=known[0]||(/^[a-z0-9][a-z0-9-]{0,99}$/.test(raw.id)?raw.id:deriveID(identity));
    for(const alias of aliases){if(owners.has(alias)&&owners.get(alias)!==id)throw new Error('论文身份冲突');owners.set(alias,id);}
    const p={...raw,id,identity};
    if(!found.has(id)){found.set(id,p);continue;}
    const old=found.get(id);
    if(old.titleEn!==p.titleEn||JSON.stringify(old.authors)!==JSON.stringify(p.authors))throw new Error(`${id}: 同日重叠记录元数据不一致，请研究方统一核验后提交`);
    for(const [key,rec] of Object.entries(p.recommendations||{})){
      if(old.recommendations[key]&&JSON.stringify(old.recommendations[key])!==JSON.stringify(rec))throw new Error(`${id}: 同类别推荐重复且内容冲突`);
      old.recommendations[key]=rec;
    }
    if(old.summary!==p.summary)old.researchNotes.push(`重叠类别补充导读：${p.summary}`);
    old.profiles=[...new Set([...old.profiles,...p.profiles])].sort();
    old.researchNotes=[...new Set([...old.researchNotes,...p.researchNotes])];
    old.evidence=[...old.evidence,...p.evidence].filter((v,i,a)=>a.findIndex(x=>x.url===v.url&&x.claim===v.claim)===i);
    for(const key of ['code','project','video','data']){
      if(old.links[key]&&p.links[key]&&old.links[key]!==p.links[key])throw new Error(`${id}: 资源核验冲突`);
      old.links[key] ||= p.links[key];
    }
  }
  return [...found.values()];
}
