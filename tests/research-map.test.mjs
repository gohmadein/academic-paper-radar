import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {beijingDate,researchMapModel,researchMapHTML} from '../lib/research-map.js';
import {mergeOccurrences} from '../lib/digest.js';
const geography={locations:{a:{city:'A',countryCode:'US',countryLabel:'美国',lat:40,lon:-90},b:{city:'B',countryCode:'CN',countryLabel:'中国',lat:39,lon:116}},papers:{p:{locationIds:['a','b','a']},q:{locationIds:['a']}}};
const p={id:'p',title:'P',profiles:['xun']},q={id:'q',title:'Q',profiles:['li']};
test('Beijing date crosses midnight eight hours ahead of UTC',()=>{
 assert.equal(beijingDate(new Date('2026-10-31T15:59:59Z')),'2026-10-31');
 assert.equal(beijingDate(new Date('2026-10-31T16:00:00Z')),'2026-11-01');
});
test('Deduplicates appearances, cities and cross-region papers with occurrence profile/date scope',()=>{
 const papers=mergeOccurrences([{date:'2026-10-31',papers:[{...p,profiles:['li']},q]},{date:'2026-10-30',papers:[p,{id:'unknown',profiles:['xun']}]}]);
 const all=researchMapModel(papers,geography,{today:'2026-10-31'});
 assert.equal(all.total,3);assert.equal(all.mapped,2);assert.equal(all.unknown,1);assert.deepEqual(all.groups.map(g=>g.papers.length),[2,1]);
 const today=researchMapModel(papers,geography,{mode:'today',today:'2026-10-31',profile:'xun'});assert.equal(today.total,0);
 const historical=researchMapModel(papers,geography,{profile:'xun'});assert.equal(historical.total,2);assert.equal(historical.groups.length,2);
 const li=researchMapModel(papers,geography,{profile:'li',mode:'today',today:'2026-10-31'});assert.equal(li.total,2);
 assert.equal(researchMapModel(papers,geography,{mode:'today',today:'2026-11-01'}).total,0);
});
test('Empty, unknown, missing geography and accessible textual selection stay honest',()=>{
 assert.match(researchMapHTML(researchMapModel([],geography,{mode:'today',today:'2026-11-01'})),/今天尚无推送/);
 const unknown=researchMapModel([{...p,date:'2026-10-31'}],null);assert.equal(unknown.unknown,1);assert.equal(unknown.groups.length,0);
 const known=researchMapModel([{...p,date:'2026-10-31'}],geography);
 const html=researchMapHTML(known,'US:A');assert.match(html,/data-map-paper="p"/);assert.match(html,/data-map-clear/);assert.match(html,/aria-label="A · 美国，1 篇论文"/);assert.match(html,/按地区浏览/);
 assert.ok(!researchMapHTML(known).includes('data-map-paper'));assert.ok(!researchMapHTML(known,'gone').includes('data-map-clear'));
});
test('Verified real dataset maps all eleven unique papers, without unresolved affiliation markers',async()=>{
 const g=JSON.parse(await readFile(new URL('../data/paper-geography.json',import.meta.url)));
 const day=JSON.parse(await readFile(new URL('../data/days/2026-10-31.json',import.meta.url)));
 const model=researchMapModel(mergeOccurrences([day]),g,{today:day.date,mode:'today'});
 assert.equal(model.total,11);assert.equal(model.mapped,11);assert.equal(model.unknown,0);
 assert.ok(!model.groups.some(g=>/Amazon|CIFAR/.test(g.label)));
 assert.equal(researchMapModel(mergeOccurrences([day]),g,{today:'2026-11-01',mode:'today'}).total,0);
});

test('Atlas occupies only the introduction, stacks below it, and ships a local land-only asset',async()=>{
 const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
 const html=await read('index.html'),css=await read('styles.css'),land=await read('lib/world-land.js');
 assert.ok(html.indexOf('id="research-map"')>html.indexOf('id="profile-motto"'));
 assert.ok(html.indexOf('id="research-map"')<html.indexOf('id="issue-panel"'));
 assert.match(css,/\.reading-intro\.with-map\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(330px,\.9fr\)/);
 assert.match(css,/@media\(max-width:1100px\)\{\.reading-intro\.with-map\{grid-template-columns:1fr/);
 assert.match(land,/Natural Earth/);assert.match(researchMapHTML({today:'2026-10-31',mode:'all',total:0,unknown:0,groups:[]}),/fill-rule="evenodd"/);
});
