import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sourceDirectory,profileSources,sourceViewPatch,SOURCE_SECTIONS} from '../lib/source-directory.js';
import {readRoute,routeHash,safeUrl} from '../lib/model.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const watchlists={profiles:JSON.parse(await read('config/profile-watchlists.json')),registry:JSON.parse(await read('config/source-registry.json'))};

test('All source records retain safe links, counts, tiers and multi-team registry entries',()=>{
  const expected={xun:[14,20,30,6,0],li:[11,7,1,4,2],lv:[0,0,7,0,0]};
  for(const category of Object.keys(expected)){
    const sources=profileSources(category,watchlists);
    assert.deepEqual(SOURCE_SECTIONS.map(([type])=>sources.filter(s=>s.type===type).length),expected[category]);
    for(const s of sources){assert.ok(SOURCE_SECTIONS.some(([type])=>type===s.type));assert.ok(s.name&&s.tier);assert.ok(Array.isArray(s.details));for(const link of s.links)assert.ok(safeUrl(link.url));}
  }
  const sources=profileSources('xun',watchlists);
  for(const name of ['Berkeley','CMU Pathak','UCSD Hao','NUS CLeAR'])assert.equal(sources.find(s=>s.name.startsWith(name)).links.length,2);
  assert.equal(new Set(sources.filter(s=>s.type==='lab').map(s=>s.tier)).size,4);
  assert.ok(sources.some(s=>s.name==='T-RL'&&s.tier.includes('新刊')));
});

test('Source markup escapes text, refuses unsafe links, distinguishes empty sections and scope',()=>{
  const html=['conference','journal','lab'].map(type=>sourceDirectory('li',watchlists,type)).join('');
  for(const text of ['PACMMOD','PVLDB','Ontop','预印本','不要求每天覆盖所有来源'])assert.ok(html.includes(text));
  assert.equal((sourceDirectory('lv',watchlists).match(/class="watchlist-pending"/g)||[]).length,1);
  const copy=structuredClone(watchlists);copy.profiles.profiles.li.sources.push({type:'conference',tier:'<img>',name:'<script>',details:['<bad>'],links:[{label:'bad',url:'javascript:alert(1)'}]});
  const escaped=sourceDirectory('li',copy);assert.ok(escaped.includes('&lt;script&gt;'));assert.ok(!escaped.includes('javascript:'));assert.ok(!escaped.includes('<bad>'));
  assert.match(sourceDirectory('xun',null),/论文档案仍可使用/);
});

test('Source route is bookmarkable and preserves date, reading status and filters on close',()=>{
  const state=readRoute('#view=sources&category=li&date=2026-10-31&q=update&read=unread');
  assert.equal(state.view,'sources');assert.deepEqual(readRoute(routeHash(state)),state);
  const closed={...state,...sourceViewPatch(state)};assert.equal(closed.view,'feed');assert.equal(closed.q,'update');assert.equal(closed.readStatus,'unread');assert.equal(closed.date,state.date);
});

test('Lv reuses seven existing teams with both Berkeley links; Xun gains Robotics Research without duplicates',()=>{
  const lv=profileSources('lv',watchlists),xun=profileSources('xun',watchlists);
  assert.equal(lv.length,7);
  for(const source of lv)assert.equal(source,watchlists.registry.sources.find(s=>s.name===source.name));
  assert.equal(lv.find(s=>s.name==='Berkeley RAIL / RLL').links.length,2);
  for(const list of [lv,xun]){
    assert.equal(list.filter(s=>s.name==='NVIDIA GEAR').length,1);
    assert.equal(list.filter(s=>s.name==='Physical Intelligence').length,1);
    const nvidia=list.find(s=>s.name==='NVIDIA GEAR');
    assert.ok(nvidia.links.some(link=>link.url==='https://www.nvidia.com/en-us/research/robotics/'));
    assert.ok(nvidia.links.some(link=>link.url==='https://research.nvidia.com/labs/gear/'));
  }
  const html=sourceDirectory('lv',watchlists,'lab');
  assert.ok(!html.includes('9 个研究入口'));
  assert.ok(html.includes('不表示覆盖两校全部实验室'));
  const broken=structuredClone(watchlists);broken.profiles.profiles.lv.registryRefs.push('missing');
  assert.throws(()=>profileSources('lv',broken),/未知来源引用/);
});

test('Section routes validate nine destinations and preserve hidden arXiv and author data',()=>{
  for(const category of ['xun','li','lv'])for(const type of ['conference','journal','lab']){
    const state=readRoute(`#view=sources&category=${category}&source=${type}`);
    assert.equal(state.sourceType,type);assert.deepEqual(readRoute(routeHash(state)),state);
    assert.equal((sourceDirectory(category,watchlists,type).match(/class="watchlist-section"/g)||[]).length,1);
  }
  for(const hash of ['#view=sources&category=li','#view=sources&category=li&source=author','#view=sources&source=bad'])assert.equal(readRoute(hash).sourceType,'conference');
  assert.equal(profileSources('li',watchlists).filter(s=>s.type==='author').length,2);
  assert.equal(profileSources('xun',watchlists).filter(s=>s.type==='arxiv').length,6);
  assert.ok(!sourceDirectory('li',watchlists,'author').includes('Diego Calvanese'));
});
