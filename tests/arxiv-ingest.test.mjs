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


test('Same-date enriched guides cannot be silently removed by metadata refresh',async()=>{
 const base=await mkdtemp(join(tmpdir(),'arxiv-guide-'));try{
  const input=sample();input.entries[0].guide={titleZh:'机器人研究',summaryZh:'本项研究依据作者摘要介绍机器人任务中的控制与学习方法，结果仍需结合原文进一步核实。'.repeat(3),summaryEn:'The guide summarizes the author abstract about robot control and learning; the reported results still require full-text verification.',whyRead:'机器人方法参考',relation:'机器人学习',prerequisites:[],difficulty:'intermediate',readRecommendation:'skim',tags:['机器人'],limits:['未独立复现'],assumptions:[],readingAdvice:['先阅读摘要'],links:{code:null,project:null,video:null,data:null},evidence:[{url:input.entries[0].url,claim:'摘要来源',checkedAt:input.checkedAt}]};
  await ingestArxivBulletin(input,{base});const saved=await readFile(join(base,'data/arxiv/days/2026-11-02.json'),'utf8');
  await assert.rejects(ingestArxivBulletin(sample(),{base}),/丢失.*导读/);assert.equal(await readFile(join(base,'data/arxiv/days/2026-11-02.json'),'utf8'),saved);
  input.entries[0].guide.whyRead='更新后的方向关联';await ingestArxivBulletin(input,{base});assert.deepEqual(await validateArxivArchive(base),[]);
 }finally{await rm(base,{recursive:true,force:true});}
});

test('Affiliation imports require registry identities and preserve previously verified units',async()=>{
 const base=await mkdtemp(join(tmpdir(),'arxiv-affiliations-'));try{
  await mkdir(join(base,'data'),{recursive:true});const input=sample();input.entries[0].affiliations=[{institutionId:'test-university',name:'Test University',institutionType:'university',authorNames:['A'],evidence:[{url:'https://arxiv.org/pdf/2611.00001',claim:'论文署名页',checkedAt:'2026-11-02'}],note:'测试署名证据'}];input.entries[0].affiliationVerification={status:'complete',checkedAt:'2026-11-02',note:'已核对署名'};
  await assert.rejects(ingestArxivBulletin(input,{base,planOnly:true}));
  const {writeFile}=await import('node:fs/promises');await writeFile(join(base,'data/institutions.json'),JSON.stringify({version:1,institutions:[{id:'test-university',officialName:'Test University',aliases:[],institutionType:'university',markType:'none',status:'needs-verification',logo:null}]}));
  await ingestArxivBulletin(input,{base});assert.deepEqual(await validateArxivArchive(base),[]);
  const next=structuredClone(input);next.entries[0].affiliations=[];next.entries[0].affiliationVerification.status='unavailable';await assert.rejects(ingestArxivBulletin(next,{base}),/丢失已核验署名机构/);
  const mismatch=structuredClone(input);mismatch.entries[0].affiliations[0].name='Other University';await assert.rejects(ingestArxivBulletin(mismatch,{base}),/机构库不一致/);
 }finally{await rm(base,{recursive:true,force:true});}
});
