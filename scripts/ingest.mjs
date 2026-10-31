import {readFile,writeFile,mkdir,cp,rename,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {validateDay} from '../lib/model.js';
import {root,validateAll} from './validate.mjs';
import {normalizePapers,aliasesFor} from './identity.mjs';
import {uniqueAssets,readAsset} from './media-assets.mjs';
import {reuseInstitutions} from '../lib/institutions.js';
const json=value=>JSON.stringify(value,null,2)+'\n';

export async function prepareDigest(input,base=root){
  if(!input||input.version!==2||!Array.isArray(input.papers))throw new Error('只接受完整的真实日报v2输入');
  const index=JSON.parse(await readFile(join(base,'data/index.json'),'utf8'));
  const registry=JSON.parse(await readFile(join(base,'data/registry.json'),'utf8'));
  const day={...structuredClone(input),papers:normalizePapers(structuredClone(input.papers),registry)};
  const institutions=JSON.parse(await readFile(join(base,'data/institutions.json'),'utf8'));
  reuseInstitutions(day.papers,institutions);
  let rules;
  try{rules=JSON.parse(await readFile(join(base,'config/digest-rules.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const normalizedTitle=value=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
  for(const p of day.papers)if(p.novelty!=='major-update'&&rules?.profiles.li.alreadyReadSeeds.some(title=>normalizedTitle(p.titleEn).includes(normalizedTitle(title))))throw new Error(`${p.id}: 已读种子不得作为普通新推荐`);
  const errors=validateDay(day);if(errors.length)throw new Error(errors.join('\n'));
  for(const record of registry.papers)record.appearances=record.appearances.filter(a=>a.date!==day.date);
  for(const p of day.papers){
    let entry=registry.papers.find(r=>r.id===p.id);
    if(entry?.appearances.length&&!p.classic&&p.novelty!=='major-update')throw new Error(`${p.id}: 已推荐过，普通新文禁止重复推送；重大变化须写明更新说明`);
    if(!entry){entry={id:p.id,aliases:[],identity:p.identity,firstSeen:day.date,lastSeen:day.date,appearances:[]};registry.papers.push(entry);}
    entry.aliases=[...new Set([...entry.aliases,...aliasesFor(p.identity)])].sort();
    entry.identity={doi:p.identity.doi||entry.identity.doi,arxiv:p.identity.arxiv||entry.identity.arxiv,other:p.identity.other||entry.identity.other};
    entry.firstSeen=[entry.firstSeen,day.date].sort()[0];entry.lastSeen=[entry.lastSeen,day.date].sort().at(-1);
    entry.appearances.push({date:day.date,profiles:p.profiles,classic:p.classic,novelty:p.novelty});
    entry.appearances.sort((a,b)=>a.date.localeCompare(b.date));
  }
  registry.papers.sort((a,b)=>a.id.localeCompare(b.id,'en'));
  index.days=index.days.filter(d=>d.date!==day.date);
  index.days.push({date:day.date,file:`days/${day.date}.json`,count:day.papers.length,title:day.title});
  index.days.sort((a,b)=>b.date.localeCompare(a.date));
  return {files:[{path:`data/days/${day.date}.json`,content:json(day)},{path:'data/index.json',content:json(index)},{path:'data/registry.json',content:json(registry)},{path:'data/institutions.json',content:json(institutions)}],summary:{date:day.date,uniquePapers:day.papers.length,profiles:Object.fromEntries(['xun','li','lv'].map(k=>[k,day.papers.filter(p=>p.profiles.includes(k)&&!p.classic).length])),classics:day.papers.filter(p=>p.classic).length}};
}

export async function ingest(input,{base=root,planOnly=false}={}){
  base=resolve(base);
  const plan=await prepareDigest(input,base);
  const stage=resolve(base,`.ingest-${randomUUID()}`),data=resolve(base,'data'),backup=resolve(stage,'previous-data');
  if(!stage.startsWith(base+sep)||data!==join(base,'data')||!backup.startsWith(stage+sep))throw new Error('不安全的事务路径');
  await mkdir(stage);
  let preserveStage=false;
  try{
    await cp(data,join(stage,'data'),{recursive:true});
    for(const file of plan.files){const target=resolve(stage,file.path);if(!target.startsWith(stage+sep))throw new Error('路径越界');await mkdir(resolve(target,'..'),{recursive:true});await writeFile(target,file.content);}
    const result=await validateAll(stage,{assetBase:base});if(result.errors.length)throw new Error(result.errors.join('\n'));
    for(const file of plan.files)file.sha256=createHash('sha256').update(file.content).digest('hex');
    plan.assetFiles=[];
    for(const asset of uniqueAssets(JSON.parse(plan.files[0].content).papers)){const bytes=await readAsset(asset,base);plan.assetFiles.push({path:asset.path,encoding:'base64',sha256:asset.sha256,content:bytes.toString('base64')});}
    if(!planOnly){
      // Stage and validate the entire dataset first. Swap directories with rollback;
      // remote publication is one atomic Git commit/ref update, not three API writes.
      await rename(data,backup);
      try{await rename(join(stage,'data'),data);}catch(error){
        try{await rename(backup,data);}catch(restoreError){preserveStage=true;throw new AggregateError([error,restoreError],`回滚未完成，原始资料已保留在 ${backup}，请恢复后继续`);}
        throw error;
      }
    }
    return plan;
  }finally{if(!preserveStage)await rm(stage,{recursive:true,force:true});}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const path=process.argv[2];if(!path)throw new Error('用法：node scripts/ingest.mjs normalized.json [--plan]');
  const result=await ingest(JSON.parse(await readFile(resolve(path),'utf8')),{planOnly:process.argv.includes('--plan')});
  console.log(process.argv.includes('--plan')?json(result):json(result.summary));
}
