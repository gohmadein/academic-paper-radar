import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,cp,mkdtemp} from 'node:fs/promises';import {tmpdir}from'node:os';import{join}from'node:path';
import {validateDay,filterPapers,profileCounts,mergeOccurrences,readRoute,routeHash}from'../lib/model.js';
import {digestDetails,digestRecommendations,categoryClass}from'../lib/digest-view.js';
import {normalizePapers,deriveID,aliasesFor}from'../scripts/identity.mjs';
import {ingest}from'../scripts/ingest.mjs';import{root,validateAll}from'../scripts/validate.mjs';
const day=JSON.parse(await readFile(new URL('../data/days/2026-10-31.json',import.meta.url),'utf8'));
const registry=JSON.parse(await readFile(new URL('../data/registry.json',import.meta.url),'utf8'));
const clone=x=>structuredClone(x);
async function fixture(){const base=await mkdtemp(join(tmpdir(),'zero-field-ingest-'));await cp(join(root,'data'),join(base,'data'),{recursive:true});await cp(join(root,'config'),join(base,'config'),{recursive:true});return base;}

test('首期11篇、类别7/2/2、回溯2篇、无伪造资源，70项来源完整',async()=>{
 assert.deepEqual(validateDay(day),[]);assert.equal(day.papers.length,11);
 assert.deepEqual(profileCounts(day.papers),{xun:{papers:7,classics:0},li:{papers:2,classics:0},lv:{papers:2,classics:0}});
 assert.equal(day.papers.filter(p=>p.novelty==='older-discovery').length,2);
 for(const p of day.papers){assert.ok([...p.summary].length>=100&&[...p.summary].length<=200);for(const url of Object.values(p.links).filter(Boolean))assert.ok(p.evidence.some(e=>e.url===url));}
 const sources=JSON.parse(await readFile(new URL('../config/source-registry.json',import.meta.url),'utf8'));
 assert.deepEqual(sources.counts,{conference:14,journal:20,arxiv:6,lab:30});assert.equal(sources.sources.length,70);
});
test('v2拒绝未知字段、短导读、无证据资源、无效状态/日期与错误经典标记',()=>{
 for(const patch of [{summary:'过短'},{summary:'文'.repeat(201)},{unexpected:'x'},{profiles:['__proto__']},{profiles:null},{identity:null},{links:null},{publicationStatus:'constructor'},{publicationDate:'2025-01-01',novelty:'recent'},{classic:true},{links:{...day.papers[0].links,code:'https://example.org/unverified'}}]){
  const d=clone(day);Object.assign(d.papers[0],patch);assert.ok(validateDay(d).length,JSON.stringify(patch));
 }
});
test('跨类别同论文合并一ID、保留不同推荐，DOI正式版沿用arXiv既有ID',()=>{
 const p=clone(day.papers[0]),second=clone(p);second.profiles=['lv'];second.recommendations={lv:{...p.recommendations.xun,whyRead:'另一个方向的推荐理由'}};
 const merged=normalizePapers([p,second],{version:1,papers:[]});assert.equal(merged.length,1);assert.deepEqual(merged[0].profiles,['lv','xun']);assert.notEqual(merged[0].recommendations.xun.whyRead,merged[0].recommendations.lv.whyRead);
 const before={version:1,papers:[{id:p.id,aliases:aliasesFor(p.identity)}]};
 const formal={...p,id:'new-doi-name',identity:{...p.identity,doi:'10.1234/example'}};
 assert.equal(normalizePapers([formal],before)[0].id,p.id);
 assert.equal(deriveID({arxiv:'https://arxiv.org/abs/2610.31841v2'}),p.id);
});
test('分类/作者/出处/本机已读组合过滤与路由可分享',()=>{
 const papers=mergeOccurrences([day]);const read=new Set([papers[0].id]);
 assert.equal(filterPapers(papers,{category:'li'}).length,2);
 assert.equal(filterPapers(papers,{q:'Gatterbauer',category:'li'}).length,1);
 assert.equal(filterPapers(papers,{q:'PVLDB'}).length,1);
 assert.equal(filterPapers(papers,{readStatus:'read',read}).length,1);
 assert.equal(filterPapers(papers,{category:'xun',readStatus:'unread',read}).length,6);
 const state=readRoute('#view=feed&category=lv&read=unread&date=2026-10-31');assert.deepEqual(readRoute(routeHash(state)),state);
});
test('详情呈现假设、阅读层级和证据，研究文本不能注入HTML',()=>{
 const p=clone(day.papers[0]);p.recommendations.xun.whyRead='<img src=x onerror=alert(1)>';p.researchNotes.push('<script>bad</script>');
 const html=digestDetails(p);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('摘要级阅读'));assert.ok(html.includes('未独立复现'));
 assert.equal(categoryClass(day.papers[7],'li'),'category-li');assert.ok(digestRecommendations(day.papers[7],'li',true).includes('TBox'));
});
test('导入计划不写入、失败保留数据，成功事务与重复运行确定一致',async()=>{
 const base=await fixture();const paths=['index.json','registry.json','days/2026-10-31.json'];
 const before=await Promise.all(paths.map(p=>readFile(join(base,'data',p),'utf8')));
 const plan=await ingest(day,{base,planOnly:true});assert.equal(plan.files.length,3);
 assert.deepEqual(await Promise.all(paths.map(p=>readFile(join(base,'data',p),'utf8'))),before);
 const invalid=clone(day);invalid.papers[0].summary='bad';await assert.rejects(ingest(invalid,{base}));
 assert.deepEqual(await Promise.all(paths.map(p=>readFile(join(base,'data',p),'utf8'))),before);
 await ingest(day,{base});assert.deepEqual((await validateAll(base)).errors,[]);
 const again=await ingest(day,{base,planOnly:true});assert.deepEqual(again,plan);
});
test('跨日重复普通推送拒绝，重大更新复用ID并保留历史日期，周一经典单独计数',async()=>{
 const base=await fixture(),next={...clone(day),date:'2026-11-01',papers:[clone(day.papers[0])]};
 next.papers[0].discoveredDate=next.date;
 await assert.rejects(ingest(next,{base}),/重复推送/);
 next.papers[0].novelty='major-update';next.papers[0].updateNote='测试夹具：新增版本，不是发布用研究结论';
 await ingest(next,{base});assert.deepEqual((await validateAll(base)).errors,[]);
 const combined=mergeOccurrences([day,next]);assert.equal(combined.length,11);assert.equal(combined[0].id,next.papers[0].id);
 assert.equal(filterPapers(combined,{date:day.date}).length,11);assert.equal(filterPapers(combined,{date:next.date}).length,1);
 const monday={...clone(day),date:'2026-11-02',papers:[clone(day.papers[7])]};monday.papers[0].classic=true;monday.papers[0].discoveredDate=monday.date;
 assert.deepEqual(validateDay(monday),[]);assert.deepEqual(profileCounts(monday.papers).li,{papers:0,classics:1});
});
