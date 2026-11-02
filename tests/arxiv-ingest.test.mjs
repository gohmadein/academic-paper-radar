import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ingestArxivBulletin,validateArxivArchive} from '../scripts/arxiv-ingest.mjs';
import {ARXIV_BULLETIN_CATEGORIES} from '../lib/arxiv-bulletin.js';
const sample=()=>({version:1,date:'2026-11-02',announcementDate:'2026-11-02',checkedAt:'2026-11-02',status:'partial',coverage:{checkedCategories:['cs.RO'],checkedCount:1,includedCount:1,limitations:['测试局部覆盖'],categoryStatus:ARXIV_BULLETIN_CATEGORIES.map(category=>({category,status:category==='cs.RO'?'partial':'unavailable',announcementDate:category==='cs.RO'?'2026-11-02':null,listedCount:category==='cs.RO'?10:null,checkedCount:category==='cs.RO'?1:0,sourceUrl:`https://arxiv.org/list/${category}/new`}))},entries:[{id:'arxiv-2611-00001',arxivId:'2611.00001',version:null,titleEn:'Robot paper',titleZh:null,authors:['A'],publishedDate:null,updatedDate:null,change:'new',categories:['cs.RO'],url:'https://arxiv.org/abs/2611.00001',topics:[],announcements:[{category:'cs.RO',change:'new'}]}]});
test('Bulletin plan, atomic import, idempotence and archive retention do not touch curated data',async()=>{
 const base=await mkdtemp(join(tmpdir(),'arxiv-ingest-'));try{
  await mkdir(join(base,'data'),{recursive:true});const input=sample();
  const plan=await ingestArxivBulletin(input,{base,planOnly:true});assert.equal(plan.files.length,2);await assert.rejects(readFile(join(base,'data/arxiv/index.json')));
  await ingestArxivBulletin(input,{base});assert.deepEqual(await validateArxivArchive(base),[]);
  const first=await readFile(join(base,'data/arxiv/days/2026-11-02.json'),'utf8');await ingestArxivBulletin(input,{base});assert.equal(await readFile(join(base,'data/arxiv/days/2026-11-02.json'),'utf8'),first);
  const invalid=sample();invalid.entries=[];invalid.coverage.includedCount=0;await assert.rejects(ingestArxivBulletin(invalid,{base}),/丢失/);assert.equal(await readFile(join(base,'data/arxiv/days/2026-11-02.json'),'utf8'),first);
  const next=sample();next.date='2026-11-03';await ingestArxivBulletin(next,{base});assert.equal(JSON.parse(await readFile(join(base,'data/arxiv/index.json'))).days.length,2);assert.equal(await readFile(join(base,'data/arxiv/days/2026-11-02.json'),'utf8'),first);
 }finally{await rm(base,{recursive:true,force:true});}
});
test('Xun curated quota and priority change only future rules; historical issues remain valid',async()=>{
 const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');const rules=JSON.parse(await read('config/digest-rules.json')),automation=JSON.parse(await read('config/automation.json'));
 assert.deepEqual([rules.profiles.xun.targetMin,rules.profiles.xun.targetMax],[3,5]);assert.deepEqual([automation.profiles.xun.dailyMin,automation.profiles.xun.dailyMax],[3,5]);assert.ok(rules.profiles.xun.arxivBulletin.separateFromCuratedQuota);assert.ok(rules.profiles.xun.arxivBulletin.noTopN);assert.match(rules.profiles.xun.selectionPriority.join(' '),/候选.*入围/);
 const history=JSON.parse(await read('data/days/2026-10-31.json'));assert.equal(history.papers.filter(p=>p.profiles.includes('xun')).length,7);
});

test('Same-date import rejects stale batch, timestamp and version regressions',async()=>{
 const base=await mkdtemp(join(tmpdir(),'arxiv-version-'));try{
  const initial=sample();initial.entries[0].version=3;initial.entries[0].updatedDate='2026-11-01';await ingestArxivBulletin(initial,{base});
  for(const mutate of [d=>d.announcementDate='2026-11-01',d=>d.checkedAt='2026-11-01',d=>d.entries[0].version=2,d=>d.entries[0].updatedDate='2026-10-31']){
   const next=structuredClone(initial);mutate(next);await assert.rejects(ingestArxivBulletin(next,{base}),/回退/);
  }
 }finally{await rm(base,{recursive:true,force:true});}
});
