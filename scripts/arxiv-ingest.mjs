import {readFile,writeFile,mkdir,readdir,cp,rename,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {validateArxivBulletin} from '../lib/arxiv-bulletin.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const json=value=>JSON.stringify(value,null,2)+'\n';
export async function validateArxivArchive(base=root){
 const errors=[];const dir=join(base,'data/arxiv');
 try{
  const index=JSON.parse(await readFile(join(dir,'index.json'),'utf8'));
  if(index.version!==1||!Array.isArray(index.days))throw Error('arXiv索引格式无效');
  const seen=new Set();
  for(const row of index.days){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||row.file!==`days/${row.date}.json`||seen.has(row.date))throw Error('arXiv索引日期/路径重复或无效');
   seen.add(row.date);const day=JSON.parse(await readFile(join(dir,row.file),'utf8'));validateArxivBulletin(day);
   if(day.date!==row.date||day.entries.length!==row.count||day.status!==row.status)throw Error('arXiv索引与公告不一致');
  }
  for(const file of await readdir(join(dir,'days')))if(!index.days.some(row=>row.file===`days/${file}`))throw Error('arXiv历史缺少索引');
 }catch(error){errors.push(error.message);}
 return errors;
}
export async function prepareArxivBulletin(input,{base=root}={}){
 validateArxivBulletin(input);
 let index;try{index=JSON.parse(await readFile(join(base,'data/arxiv/index.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;index={version:1,days:[]};}
 const prior=index.days.find(row=>row.date===input.date);
 if(prior){
  const old=JSON.parse(await readFile(join(base,'data/arxiv',prior.file),'utf8'));validateArxivBulletin(old);
  if(old.announcementDate&&(!input.announcementDate||input.announcementDate<old.announcementDate))throw Error('公告批次回退，保留上次有效资料');
  if(Date.parse(input.checkedAt)<Date.parse(old.checkedAt))throw Error('核验时刻回退，保留上次有效资料');
  for(const entry of old.entries){const next=input.entries.find(item=>item.arxivId===entry.arxivId);if(entry.guide&&next&&!next.guide)throw Error('刷新会丢失已归档导读，保留上次有效资料');if(next&&((entry.version!==null&&(next.version===null||next.version<entry.version))||(entry.updatedDate&&(!next.updatedDate||next.updatedDate<entry.updatedDate))))throw Error('论文版本回退，保留上次有效资料');}
  if(old.status==='complete'&&input.status!=='complete')throw Error('刷新未完成，保留已发布的完整公告');
  if(old.entries.some(entry=>!input.entries.some(next=>next.arxivId===entry.arxivId)))throw Error('刷新会丢失已归档条目，保留上次有效资料');
 }
 const day=structuredClone(input);day.entries.sort((a,b)=>a.arxivId.localeCompare(b.arxivId));
 index.days=index.days.filter(row=>row.date!==day.date);index.days.push({date:day.date,file:`days/${day.date}.json`,count:day.entries.length,status:day.status});index.days.sort((a,b)=>b.date.localeCompare(a.date));
 return {files:[{path:`data/arxiv/days/${day.date}.json`,content:json(day)},{path:'data/arxiv/index.json',content:json(index)}]};
}
export async function ingestArxivBulletin(input,{base=root,planOnly=false}={}){
 const plan=await prepareArxivBulletin(input,{base});if(planOnly)return plan;
 const stage=join(base,`.arxiv-stage-${randomUUID()}`),target=join(base,'data/arxiv'),backup=join(stage,'previous');await mkdir(join(stage,'data/arxiv/days'),{recursive:true});
 let preserveStage=false;
 try{
  await cp(target,join(stage,'data/arxiv'),{recursive:true}).catch(error=>{if(error.code!=='ENOENT')throw error;});
  for(const file of plan.files)await writeFile(join(stage,file.path),file.content);
  const errors=await validateArxivArchive(stage);if(errors.length)throw Error(errors.join('\n'));
  let previous=false;try{await rename(target,backup);previous=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  try{await mkdir(join(base,'data'),{recursive:true});await rename(join(stage,'data/arxiv'),target);}catch(error){if(previous){try{await rename(backup,target);}catch(restoreError){preserveStage=true;throw new AggregateError([error,restoreError],`arXiv回滚失败，原资料保留于 ${backup}`);}}throw error;}
 }finally{if(!preserveStage)await rm(stage,{recursive:true,force:true});}
 return plan;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const input=JSON.parse(await readFile(resolve(process.argv[2]),'utf8'));console.log(json(await ingestArxivBulletin(input,{planOnly:process.argv.includes('--plan')})));
}
