import test from 'node:test';
import assert from 'node:assert/strict';
import {ARXIV_BULLETIN_CATEGORIES,validateArxivBulletin,bulletinHTML} from '../lib/arxiv-bulletin.js';
const paper=()=>({id:'arxiv-2610-40473',arxivId:'2610.40473',version:2,titleEn:'Learning robot control',titleZh:'机器人控制学习',authors:['A Author','B Author'],publishedDate:'2026-10-29',updatedDate:'2026-11-02',change:'revised',categories:['cs.RO','cs.LG'],url:'https://arxiv.org/abs/2610.40473v2',topics:['操作','机器人学习'],announcements:[{category:'cs.RO',change:'revised'}]});
const rows=(status='complete')=>ARXIV_BULLETIN_CATEGORIES.map(category=>({category,status,announcementDate:status==='complete'?'2026-11-02':null,listedCount:status==='complete'?210:null,checkedCount:status==='complete'?210:0,sourceUrl:`https://arxiv.org/list/${category}/new`}));
const bulletin=()=>({version:1,date:'2026-11-02',announcementDate:'2026-11-02',checkedAt:'2026-11-02T05:30:00Z',status:'complete',coverage:{checkedCategories:[...ARXIV_BULLETIN_CATEGORIES],checkedCount:1260,includedCount:1,limitations:[],categoryStatus:rows()},entries:[paper()]});

test('Complete bulletin validates and renders every supplied entry in native details',()=>{
 const data=bulletin();assert.equal(validateArxivBulletin(data),data);
 data.entries=Array.from({length:60},(_,i)=>({...paper(),id:`arxiv-2610-${String(i).padStart(5,'0')}`,arxivId:`2610.${String(i).padStart(5,'0')}`,url:`https://arxiv.org/abs/2610.${String(i).padStart(5,'0')}`}));data.coverage.includedCount=60;
 const html=bulletinHTML(data);assert.match(html,/^<details/);assert.match(html,/<summary>每日 arXiv 更新/);assert.equal((html.match(/class="arxiv-bulletin-item"/g)||[]).length,60);assert.match(html,/预印本/);assert.match(html,/修订/);assert.match(html,/60 篇/);
});

test('Dates, canonical URLs, base IDs and versions are strict',()=>{
 for(const patch of [{publishedDate:'2026-02-29'},{updatedDate:'2026-10-28'},{arxivId:'2613.40473'},{arxivId:'2610.40473v2'},{id:'another'},{version:0},{version:1.2},{url:'javascript:alert(1)'},{url:'https://arxiv.org.evil/abs/2610.40473v2'},{url:'https://arxiv.org/abs/2610.40473v3'},{change:'accepted'},{categories:['cs.RO','cs.RO']}]){
  const data=bulletin();Object.assign(data.entries[0],patch);assert.throws(()=>validateArxivBulletin(data));
 }
 for(const patch of [{date:'2026-02-29'},{announcementDate:'bad'},{checkedAt:'yesterday'},{checkedAt:'2026-02-30T01:00:00Z'},{checkedAt:'2026-11-02T24:00:00Z'},{version:2}])assert.throws(()=>validateArxivBulletin({...bulletin(),...patch}));
 for(const checkedAt of ['2026-11-02','2026-11-02T13:30:00+08:00','2026-11-02T05:30:00.123Z'])assert.doesNotThrow(()=>validateArxivBulletin({...bulletin(),checkedAt}));
 const leap=bulletin();leap.date='2028-02-29';assert.doesNotThrow(()=>validateArxivBulletin(leap));
});

test('Rejects duplicate base across versions and inconsistent coverage without truncation',()=>{
 const data=bulletin();data.entries.push({...paper(),version:3,url:'https://arxiv.org/abs/2610.40473v3'});data.coverage.includedCount=2;assert.throws(()=>validateArxivBulletin(data),/重复/);
 for(const coverage of [{includedCount:0},{checkedCount:0},{checkedCount:null},{checkedCount:-1},{checkedCategories:['cs.RO']},{checkedCategories:['cs.RO','other']},{limitations:[null]}]){
  const value=bulletin();Object.assign(value.coverage,coverage);assert.throws(()=>validateArxivBulletin(value));
 }
 const extra=bulletin();extra.entries[0].unsafe='bad';assert.throws(()=>validateArxivBulletin(extra));
});

test('Escapes titles, authors, topics and limitation text; unsafe URLs never render',()=>{
 const data=bulletin(),attack='<img src=x onerror="alert(1)">';data.entries[0].titleZh=attack;data.entries[0].titleEn=attack;data.entries[0].authors=[attack,'two','three','four'];data.entries[0].topics=[attack];data.coverage.limitations=[attack];
 const html=bulletinHTML(data);assert.doesNotMatch(html,/<img|<script/);assert.match(html,/&lt;img/);assert.match(html,/等 4 人/);assert.match(html,/rel="noopener noreferrer"/);
 data.entries[0].url='javascript:alert(1)';assert.doesNotMatch(bulletinHTML(data),/javascript:/);assert.match(bulletinHTML(data),/暂不可用/);
 data.entries[0]={...paper(),titleZh:null};assert.doesNotMatch(bulletinHTML(data),/>null</);
});

test('Partial/unavailable/null states honestly distinguish unverified from confirmed empty',()=>{
 const partial=bulletin();partial.status='partial';partial.coverage.checkedCategories=['cs.RO'];partial.coverage.categoryStatus=rows('unavailable');partial.coverage.categoryStatus[0]={...rows()[0],status:'partial',checkedCount:1};partial.coverage.checkedCount=null;partial.coverage.limitations=['其他分类尚未完成'];assert.doesNotThrow(()=>validateArxivBulletin(partial));assert.match(bulletinHTML(partial),/部分核验/);assert.match(bulletinHTML(partial),/检索总量未确认/);
 partial.coverage.limitations=[];assert.throws(()=>validateArxivBulletin(partial));
 const unavailable={...bulletin(),status:'unavailable',announcementDate:null,entries:[],coverage:{checkedCategories:[],checkedCount:null,includedCount:0,limitations:['官方来源暂不可访问'],categoryStatus:rows('unavailable')}};
 assert.doesNotThrow(()=>validateArxivBulletin(unavailable));const html=bulletinHTML(unavailable);assert.match(html,/未确认/);assert.doesNotMatch(html,/0 篇|未收录相关更新/);
 for(const coverage of [{checkedCount:0},{includedCount:1},{checkedCategories:['cs.RO']}])assert.throws(()=>validateArxivBulletin({...unavailable,coverage:{...unavailable.coverage,...coverage}}));
 assert.match(bulletinHTML(null),/未能确认/);assert.match(bulletinHTML({}),/未能确认/);
 const empty=bulletin();empty.entries=[];empty.coverage.includedCount=0;assert.match(bulletinHTML(empty),/本次核验未收录/);
});


test('Unknown metadata remains null and cross-category announcement changes are retained',()=>{
 const data=bulletin();Object.assign(data.entries[0],{version:null,publishedDate:null,updatedDate:null,url:'https://arxiv.org/abs/2610.40473',change:'new',announcements:[{category:'cs.RO',change:'cross-list'},{category:'cs.LG',change:'new'}]});
 assert.doesNotThrow(()=>validateArxivBulletin(data));assert.match(bulletinHTML(data),/版本未核实/);assert.doesNotMatch(bulletinHTML(data),/vnull/);
 data.entries[0].change='cross-list';assert.throws(()=>validateArxivBulletin(data));data.entries[0].change='new';data.entries[0].url+='v2';assert.throws(()=>validateArxivBulletin(data));
});

test('Requires honest complete six-category announcement coverage and official sources',()=>{
 for(const mutate of [d=>d.coverage.categoryStatus.pop(),d=>d.coverage.categoryStatus[1].announcementDate='2026-11-01',d=>d.coverage.categoryStatus[1].sourceUrl='https://arxiv.org.evil/list/cs.CV/new',d=>d.coverage.categoryStatus[1].checkedCount=1,d=>d.coverage.categoryStatus[1].category='cs.RO']){
  const data=bulletin();mutate(data);assert.throws(()=>validateArxivBulletin(data));
 }
});

test('Complete status requires an identified announcement batch',()=>{
 const data=bulletin();data.announcementDate=null;data.coverage.categoryStatus.forEach(row=>row.announcementDate=null);assert.throws(()=>validateArxivBulletin(data));
});
