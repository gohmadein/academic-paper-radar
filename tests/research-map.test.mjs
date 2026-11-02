import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {beijingDate,researchMapModel,researchMapHTML,positionMapMarkers} from '../lib/research-map.js';
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


test('Strict CSP markers receive distinct projected positions through individual CSSOM properties',async()=>{
 const model=researchMapModel([{...p,date:'2026-10-31'}],geography);
 const markup=researchMapHTML(model);
 assert.doesNotMatch(markup,/style=/);
 const markers=[...markup.matchAll(/data-map-x="([^"]+)" data-map-y="([^"]+)"/g)].map(([,mapX,mapY])=>({dataset:{mapX,mapY},style:{}}));
 assert.equal(markers.length,2);
 positionMapMarkers({querySelectorAll:selector=>{assert.equal(selector,'.map-marker');return markers;}});
 assert.deepEqual(markers[0].style,{left:'25%',top:'27.778%'});
 assert.deepEqual(markers[1].style,{left:'82.222%',top:'28.333%'});
 const malformed={dataset:{mapX:'bad',mapY:'101'},style:{}};positionMapMarkers({querySelectorAll:()=>[malformed]});assert.deepEqual(malformed.style,{});
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/style-src 'self';/);assert.ok(!html.includes("'unsafe-inline'"));
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');assert.match(app,/innerHTML=markup;\s+positionMapMarkers\(document\)/);
});

test('Xun region disclosure and selected results share a bounded keyboard-scrollable pane',async()=>{
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(css,/@media\(min-width:1101px\)\{\.with-calendar #research-map\{contain:size\}\}/);
 assert.match(css,/\.with-calendar #research-map \.map-browser\{flex:1 1 0;min-height:0;overflow:auto;/);
 assert.match(css,/@media\(max-width:1100px\)\{\.with-calendar #research-map\{height:580px\}\}/);
 assert.match(css,/@media\(max-width:600px\)\{\.with-calendar #research-map\{height:480px\}\}/);
 assert.match(css,/\.with-calendar #research-map \.map-surface\{flex:0 0 auto;aspect-ratio:2;margin:8px 0;min-height:0\}/);
 const model=researchMapModel([{...p,date:'2026-10-31'}],geography);
 for(const selected of ['', 'US:A']){
  const html=researchMapHTML(model,selected);
  assert.match(html,/<div class="map-browser" tabindex="0" role="region" aria-label="地区浏览与论文列表">/);
  assert.ok(html.indexOf('class="map-browser"')>html.indexOf('class="map-surface'));
  assert.ok(html.indexOf('class="map-browser"')<html.indexOf('<details id="map-regions"'));
  assert.match(html,/<summary>按地区浏览/);assert.ok(html.endsWith('</details></div>'));
 }
});
