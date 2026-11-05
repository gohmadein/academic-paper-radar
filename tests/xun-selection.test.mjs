import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateXunSelection} from '../lib/xun-selection.js';
const rules=JSON.parse(await readFile(new URL('../config/digest-rules.json',import.meta.url)));
const paper=(type='conference',status='published',profiles=['xun'])=>({id:`test-${type}`,profiles,publicationStatus:status,identity:{arxiv:'2601.12345'},sources:[{url:'https://arxiv.org/abs/2601.12345'}],formalPublication:{type,evidenceUrl:'https://proceedings.mlr.press/test'},evidence:[{url:'https://proceedings.mlr.press/test',claim:'Official publication record'}]});
const full=()=>({date:'2026-11-06',papers:[...Array.from({length:3},()=>paper()),...Array.from({length:2},()=>paper('journal'))],coverage:{limitations:[]}});
test('exact 3 conference + 2 journal accepts formal papers with arxiv reading links',()=>{
 assert.deepEqual(validateXunSelection(full(),rules),[]);
 const day=full();day.papers[0].publicationStatus='accepted';assert.deepEqual(validateXunSelection(day,rules),[]);
 const x=rules.profiles.xun;assert.deepEqual([x.targetMin,x.targetMax],[5,5]);assert.deepEqual(x.curatedPublicationPolicy.dailyQuota,{conference:3,journal:2});assert.equal(x.curatedPublicationPolicy.ratioIsSoft,false);
});
test('preprints unknown workshop and missing official classification are rejected',()=>{
 for(const status of ['preprint','unknown','workshop']){const d=full();d.papers[0].publicationStatus=status;assert.ok(validateXunSelection(d,rules).length);}
 const d=full();delete d.papers[0].formalPublication;assert.ok(validateXunSelection(d,rules).length);
});
test('arxiv-only formal evidence or unlinked evidence is rejected',()=>{
 for(const url of ['https://arxiv.org/abs/2601.12345','https://export.arxiv.org/abs/2601.12345','javascript:alert(1)','https://other.org']){const d=full();d.papers[0].formalPublication.evidenceUrl=url;assert.ok(validateXunSelection(d,rules).length);}
});
test('quota slots cannot be substituted and shortage needs accurate explicit reason',()=>{
 const d=full();d.papers[4]=paper();assert.ok(validateXunSelection(d,rules).some(e=>e.includes('超出')));
 d.papers=d.papers.slice(0,3);assert.ok(validateXunSelection(d,rules).some(e=>e.includes('缺口')));
 d.coverage.limitations=['迅精选不足：会议 3/3，期刊 0/2；本轮没有核验充分且未推荐的期刊候选。'];assert.deepEqual(validateXunSelection(d,rules),[]);
 d.coverage.limitations=['迅精选不足：会议 2/3，期刊 0/2；错误数量'];assert.ok(validateXunSelection(d,rules).length);
 const empty={date:'2026-11-06',papers:[],coverage:{limitations:['迅精选不足：会议 0/3，期刊 0/2；本轮来源访问失败，不能确认候选。']}};assert.deepEqual(validateXunSelection(empty,rules),[]);
});
test('history preserved and other profiles excluded from Xun quota',()=>{
 const d=full();d.date='2026-11-05';d.papers=[paper('conference','preprint')];assert.deepEqual(validateXunSelection(d,rules),[]);
 const future=full();future.papers.push(paper('conference','preprint',['li','lv']));assert.deepEqual(validateXunSelection(future,rules),[]);
 future.papers[0].profiles=['xun','lv'];future.papers[0].publicationStatus='preprint';assert.ok(validateXunSelection(future,rules).length);
});
test('new metadata passes the strict daily schema without changing archived records',async()=>{
 const {validateDay}=await import('../lib/model.js');
 const d=JSON.parse(await readFile(new URL('../data/days/2026-11-05.json',import.meta.url)));
 d.date='2026-11-06';
 for(const p of d.papers.filter(p=>p.profiles.includes('xun')))p.formalPublication={type:'conference',evidenceUrl:'https://2026.corl.org/program/accepted-papers'};
 d.coverage.limitations.push('迅精选不足：会议 3/3，期刊 0/2；测试：无充分核验期刊候选。');
 assert.deepEqual(validateDay(d),[]);assert.deepEqual(validateXunSelection(d,rules),[]);
 d.papers[0].formalPublication.extra='bad';assert.ok(validateDay(d).length);
});
