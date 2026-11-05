import {validateXunSelection} from '../lib/xun-selection.js';
import {validateInstitutionDisplay} from '../lib/institution-display.js';
import {validateArxivArchive} from './arxiv-ingest.mjs';
import {profileSources} from '../lib/source-directory.js';
import {validateCalendarProfiles} from '../lib/research-calendar.js';
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';
import {validateIndex, validateDay,isDate} from '../lib/model.js';
import {aliasesFor} from './identity.mjs';
import {validateAssetFiles,uniqueAssets} from './media-assets.mjs';

import {validateInstitutions} from '../lib/institutions.js';
import {validateGeography} from '../lib/geography-validation.js';
export const root = fileURLToPath(new URL('../', import.meta.url));
export async function validateAll(base = root,{assetBase=base}={}) {
  const errors = [];
  let rules;
  try { rules=JSON.parse(await readFile(join(base,'config/digest-rules.json'),'utf8')); } catch(error) { if(error.code!=='ENOENT')throw error; }
  let count = 0;
  const assetPaths=new Set();
  for (const [directory,demo] of [['data',false],['data/demo',true]]) {
    const path = join(base,directory);
    let index;
    try { index = JSON.parse(await readFile(join(path,'index.json'),'utf8')); }
    catch { errors.push(`${directory}/index.json: 无法读取 JSON`); continue; }
    const indexErrors = validateIndex(index);
    errors.push(...indexErrors.map(e => `${directory}: ${e}`));
    if (indexErrors.length) continue;
    const ids = new Set();
    const realRecords=[];
    for (const entry of [...index.days].sort((a,b)=>a.date.localeCompare(b.date))) {
      let day;
      try { day = JSON.parse(await readFile(join(path,entry.file),'utf8')); }
      catch { errors.push(`${directory}/${entry.file}: 无法读取 JSON`); continue; }
      errors.push(...validateDay(day,{demo}).map(e => `${directory}/${entry.file}: ${e}`));
      if(!demo)errors.push(...validateXunSelection(day,rules).map(e => `${directory}/${entry.file}: ${e}`));
      if (day.date !== entry.date || day.title !== entry.title || day.papers?.length !== entry.count) errors.push(`${directory}/${entry.file}: 日期、标题或数量与索引不一致`);
      if (Array.isArray(day.papers)) for (const p of day.papers) {
        if (ids.has(p.id) && !(day.version===2&&(p.classic||p.novelty==='major-update'))) errors.push(`${directory}: 跨日期重复 id ${p.id}`);
        ids.add(p.id);
        if(!demo&&day.version===2)realRecords.push({paper:p,date:day.date});
        if (!demo && JSON.stringify(p).includes('example.com/replace-with')) errors.push(`${p.id}: 仍使用模板来源`);
      }
      count++;
    }
    if(!demo){
      try{const geography=JSON.parse(await readFile(join(path,'paper-geography.json'),'utf8'));errors.push(...validateGeography(geography).map(e=>'data/paper-geography.json: '+e));}catch(error){if(error.code!=='ENOENT')errors.push(`data/paper-geography.json: ${error.message}`);}
      try{const institutions=JSON.parse(await readFile(join(path,'institutions.json'),'utf8'));errors.push(...validateInstitutions(institutions,realRecords.map(x=>x.paper)),...validateInstitutionDisplay(institutions));const libraryPapers=[{visuals:{institutions:institutions.institutions}}];errors.push(...await validateAssetFiles(libraryPapers,assetBase));for(const asset of uniqueAssets(libraryPapers))assetPaths.add(asset.path);}catch(error){errors.push(`data/institutions.json: ${error.message}`);}
      errors.push(...await validateAssetFiles(realRecords.map(x=>x.paper),assetBase));
      try{for(const asset of uniqueAssets(realRecords.map(x=>x.paper)))assetPaths.add(asset.path);}catch{}
      try{
        const registry=JSON.parse(await readFile(join(path,'registry.json'),'utf8'));
        if(registry.version!==1||!Array.isArray(registry.papers))throw new Error('注册表根结构无效');
        const owners=new Map();
        const registryIDs=new Set();
        for(const record of registry.papers){
          if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(record.id)||registryIDs.has(record.id)||!Array.isArray(record.aliases)||!record.aliases.length||record.aliases.some(a=>typeof a!=='string')||!Array.isArray(record.appearances)||!isDate(record.firstSeen)||!isDate(record.lastSeen))throw new Error('注册表ID或别名结构无效');
          registryIDs.add(record.id);
          for(const alias of record.aliases){if(owners.has(alias)&&owners.get(alias)!==record.id)throw new Error('注册表身份别名重复');owners.set(alias,record.id);}
        }
        for(const {paper,date} of realRecords){const record=registry.papers.find(r=>r.id===paper.id);if(!record?.appearances.some(a=>a.date===date)||aliasesFor(paper.identity).some(alias=>!record?.aliases.includes(alias)))errors.push(`${paper.id}: 注册表缺少日报记录或身份别名 ${date}`);}
      }catch(error){if(realRecords.length||error.code!=='ENOENT')errors.push(`data/registry.json: ${error.message}`);}
    }
    const files = await readdir(join(path,'days')).catch(error => error.code==='ENOENT' ? [] : Promise.reject(error));
    for (const file of files) if (!index.days.some(e => e.file===`days/${file}`)) errors.push(`${directory}/days/${file}: 未写入日期索引`);
  }
  try{
    const calendar=JSON.parse(await readFile(join(base,'data/conference-calendar.json'),'utf8'));
    const registry=JSON.parse(await readFile(join(assetBase,'config/source-registry.json'),'utf8').catch(()=>readFile(join(root,'config/source-registry.json'),'utf8')));
    const profiles=JSON.parse(await readFile(join(assetBase,'config/profile-watchlists.json'),'utf8').catch(()=>readFile(join(root,'config/profile-watchlists.json'),'utf8')));
    const expected=Object.fromEntries(['xun','li','lv'].map(profile=>[profile,profileSources(profile,{profiles,registry}).filter(source=>source.type==='conference').map(source=>source.name)]));
    errors.push(...validateCalendarProfiles(calendar,expected).map(error=>'data/conference-calendar.json: '+error));
  }catch(error){errors.push('data/conference-calendar.json: '+error.message);}
  errors.push(...(await validateArxivArchive(base)).map(error=>'data/arxiv: '+error));
  return {errors,count,assets:[...assetPaths].sort()};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateAll();
  if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
  else console.log(`数据校验通过：${result.count} 个日报文件（真实与演示分开校验）。`);
}
