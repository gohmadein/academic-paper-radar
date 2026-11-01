import * as researchMap from '../lib/research-map.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as profileIcons from '../lib/profile-icons.js';
import * as sources from '../lib/source-directory.js';
import * as topics from '../lib/topics.js';
import * as model from '../lib/model.js';
import * as digest from '../lib/digest-view.js';
import * as institutions from '../lib/institutions.js';
import * as transfer from '../lib/bookmark-transfer.js';
import * as notes from '../lib/paper-notes.js';
import * as notesView from '../lib/notes-view.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const index=JSON.parse(await read('data/index.json'));
const latestDay=JSON.parse(await read('data/'+index.days[0].file));
const latestCount=category=>latestDay.papers.filter(p=>category==='all'||p.profiles.includes(category)).length;

async function appHarness({stored=new Map(),storageBlocked=false}={}){
  const elements=new Map(),events={},windowEvents={},bodyClasses=new Set(),entries=[''],location={hash:''};
  let position=0;
  const element=id=>{
    if(!elements.has(id))elements.set(id,{id,hidden:false,value:'',innerHTML:'',textContent:'',dataset:{},childNodes:[{textContent:''}],classList:{toggle(){},add(){},remove(){}},attributes:{},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]},addEventListener(type,fn){events[id+':'+type]=fn},open:false,isConnected:true,focus(){context.document.activeElement=this},close(){this.open=false},showModal(){this.open=true}});
    return elements.get(id);
  };
  const context=vm.createContext({...researchMap,...profileIcons,...sources,...topics,...model,...digest,...institutions,...transfer,...notes,...notesView,
    e:model.escapeHTML,updateHUD(){},console,URL,URLSearchParams,TextEncoder,CSS:{escape:x=>x},setTimeout,clearTimeout,
    document:{getElementById:element,querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:{classList:{toggle(name,on){if(on)bodyClasses.add(name);else bodyClasses.delete(name)}}},addEventListener:(type,fn)=>{events[type]=fn}},
    window:{addEventListener:(type,fn)=>{windowEvents[type]=fn}},
    localStorage:{getItem:k=>{if(storageBlocked)throw Error('storage blocked');return stored.get(k)??null},setItem:(k,v)=>{if(storageBlocked)throw Error('storage blocked');stored.set(k,v)}},
    location,
    history:{pushState(_a,_b,hash){entries.splice(++position);entries.push(hash);location.hash=hash},replaceState(_a,_b,hash){entries[position]=hash;location.hash=hash}},
    fetch:async url=>({ok:true,json:async()=>JSON.parse(await readFile(url,'utf8'))})
  });
  let source=await read('app.js');
  source=source.replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',JSON.stringify(new URL('../app.js',import.meta.url).href)).replace('\ninit();','\nglobalThis.boot=init();');
  vm.runInContext(source,context);await context.boot;
  const run=code=>vm.runInContext(code,context);
  return {element,run,events,stored,bodyClasses,click:dataset=>events.click({target:{closest:()=>({dataset})}}),
    back(){location.hash=entries[--position];windowEvents.popstate()},
    forward(){location.hash=entries[++position];windowEvents.popstate()}};
}

test('Sidebar is the only category chooser; desktop rail and compact mobile layout preserve bottom gallery',async()=>{
  const html=await read('index.html'),css=await read('styles.css');
  assert.equal((html.match(/id="category-tabs"/g)||[]).length,1);
  assert.ok(html.indexOf('id="category-tabs"')<html.indexOf('<main'));
  assert.ok(html.indexOf('id="institution-gallery"')>html.indexOf('<aside class="sidebar"'));
  assert.ok(html.indexOf('id="institution-gallery"')<html.indexOf('<footer>'));
  assert.match(css,/\.navigation-rail\{position:sticky;top:0;height:100vh;height:100dvh;overflow-y:auto/);
  assert.match(css,/@media\(max-width:800px\)/);
  assert.match(css,/\.profile-links\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/\.profile-link-copy strong\{font-size:12px;white-space:nowrap\}/);
});

test('Live app routes all three feeds, repeated switches, Back/Forward and combined search/date filters',async()=>{
  const h=await appHarness();
  const count=()=> (h.element('content').innerHTML.match(/<article /g)||[]).length;
  assert.equal(count(),latestCount('all'));
  for(const category of ['xun','li','lv','all','li']){
    const n=latestCount(category);
    h.click({category});assert.equal(count(),n);
    assert.match(h.element('category-tabs').innerHTML,new RegExp('data-category="'+category+'"[^>]*aria-pressed="true"'));
  }
  h.back();assert.equal(h.run('state.category'),'all');assert.equal(count(),latestCount('all'));
  h.forward();assert.equal(h.run('state.category'),'li');assert.equal(count(),latestCount('li'));
  h.run("go({q:'Gatterbauer',date:'2026-10-31'})");
  assert.equal(count(),1);
  h.click({category:'xun'});assert.equal(count(),0);
  assert.equal(h.run('state.q'),'Gatterbauer');assert.equal(h.run('state.date'),'2026-10-31');
  h.click({category:'li'});assert.equal(count(),1);
});

test('Bookmark scope, archive navigation, daily-only hero/gallery and saved state survive category switches',async()=>{
  const h=await appHarness();
  const id=h.run("data.real.papers.find(p=>p.profiles.includes('li')).id");
  h.click({bookmark:id});assert.ok(h.stored.get('paper-signal-bookmarks-v1').includes(id));
  h.click({view:'bookmarks'});h.click({category:'li'});
  assert.equal(h.run('state.view'),'bookmarks');
  assert.equal((h.element('content').innerHTML.match(/<article /g)||[]).length,1);
  assert.equal(h.element('hero').hidden,true);assert.equal(h.element('institution-gallery').innerHTML,'');
  h.click({category:'xun'});
  assert.equal((h.element('content').innerHTML.match(/<article /g)||[]).length,0);
  h.click({view:'archive'});assert.match(h.element('content').innerHTML,/archive-card/);
  h.click({category:'lv'});assert.equal(h.run('state.view'),'feed');
  assert.equal(h.element('hero').hidden,false);assert.match(h.element('institution-gallery').innerHTML,/institution-library/);
  h.click({view:'archive'});h.click({date:'2026-10-31'});
  assert.equal(h.run('state.category'),'lv');assert.equal(h.run('state.date'),'2026-10-31');
  assert.equal((h.element('content').innerHTML.match(/<article /g)||[]).length,2);
});

test('Collapse repeats safely, persists on reload, preserves focus, routes and history',async()=>{
  const h=await appHarness(),toggle=h.element('rail-toggle');
  toggle.focus();
  const originalHash=h.run('location.hash');
  for(let i=0;i<6;i++){
    h.events['rail-toggle:click']();
    const collapsed=i%2===0;
    assert.equal(h.bodyClasses.has('rail-collapsed'),collapsed);
    assert.equal(toggle.attributes['aria-expanded'],String(!collapsed));
    assert.equal(toggle.attributes['aria-label'],collapsed?'展开侧栏':'收起侧栏');
    assert.equal(h.run('document.activeElement.id'),'rail-toggle');
    assert.equal(h.run('location.hash'),originalHash);
  }
  h.events['rail-toggle:click']();
  h.click({category:'li'});h.click({category:'lv'});h.back();h.forward();
  assert.equal(h.bodyClasses.has('rail-collapsed'),true);
  assert.equal(h.run('state.category'),'lv');
  const reloaded=await appHarness({stored:h.stored});
  assert.equal(reloaded.bodyClasses.has('rail-collapsed'),true);
  assert.equal(reloaded.element('rail-toggle').attributes['aria-expanded'],'false');
  reloaded.events['rail-toggle:click']();
  assert.equal(reloaded.stored.get('zero-field-rail-collapsed-v1'),'false');
});

test('Unavailable layout storage is harmless; icon destinations retain accessible names',async()=>{
  const h=await appHarness({storageBlocked:true});
  assert.equal(h.element('rail-toggle').attributes['aria-expanded'],'true');
  h.events['rail-toggle:click']();h.click({category:'li'});
  assert.equal(h.bodyClasses.has('rail-collapsed'),true);
  assert.equal((h.element('content').innerHTML.match(/<article /g)||[]).length,latestCount('li'));
  h.events['rail-toggle:click']();assert.equal(h.bodyClasses.has('rail-collapsed'),false);
  const html=await read('index.html'),css=await read('styles.css');
  assert.match(html,/aria-controls="profile-navigation rail-utilities"/);
  for(const label of ['每日精选','日期归档','本机书签','关于本站'])assert.ok(html.includes('aria-label="'+label+'"'));
  for(const label of ['全部方向','迅的推送','李的推送','驴的推送'])assert.ok(h.element('category-tabs').innerHTML.includes('aria-label="'+label+'"'));
  assert.ok(css.includes('body.rail-collapsed{grid-template-columns:76px minmax(0,1fr)'));
  assert.ok(css.includes('.rail-collapsed .profile-link{min-height:44px;justify-content:center}'));
});

test('Broad theme chips follow profiles, compose in bookmarks, and preserve legacy links/history',async()=>{
  const h=await appHarness();
  // Fixed historical fixture supplies the legacy fine-tag regression cases.
  h.run("go({date:'2026-10-31'})");
  const count=()=> (h.element('content').innerHTML.match(/<article /g)||[]).length;
  h.click({category:'xun'});
  assert.equal((h.element('tags').innerHTML.match(/<button /g)||[]).length,6);
  assert.ok(!h.element('tags').innerHTML.includes('数据库'));
  h.click({tag:'topic:robot-control'});assert.ok(count()>1);
  h.click({category:'li'});assert.equal(h.run('state.tag'),'all');assert.equal(count(),2);
  h.back();assert.equal(h.run('state.tag'),'topic:robot-control');assert.equal(h.run('state.category'),'xun');
  h.forward();assert.equal(h.run('state.category'),'li');
  h.click({category:'xun'});h.click({tag:'力觉'});assert.equal(count(),1);
  assert.ok(h.element('tags').innerHTML.includes('关键词：力觉'));
  const id=h.run("data.real.papers.find(p=>p.tags.includes('力觉')).id");
  h.click({bookmark:id});h.click({view:'bookmarks'});h.click({tag:'topic:robot-control'});
  assert.equal(h.run('state.view'),'bookmarks');assert.equal(count(),1);
  h.click({read:id});h.run("go({readStatus:'unread'})");assert.equal(count(),0);
  h.run("go({readStatus:'read',q:'力觉'})");assert.equal(count(),1);
  h.click({view:'archive'});assert.equal(h.element('filter-panel').hidden,true);
  h.click({date:'2026-10-31'});assert.equal(h.run('state.tag'),'all');
});

test('Source view follows profiles, preserves filters, supports repeated toggles and Back/Forward',async()=>{
  const h=await appHarness();
  h.run("go({category:'li',q:'Gatterbauer',date:'2026-10-31',tag:'all'})");
  h.click({sourceProfile:'li'});
  assert.equal(h.run('state.view'),'sources');
  assert.match(h.element('content').innerHTML,/SIGMOD/);
  assert.equal(h.element('filter-panel').hidden,true);
  assert.equal(h.element('hero').hidden,true);
  assert.equal(h.element('institution-gallery').innerHTML,'');
  h.click({sourceProfile:'lv'});
  assert.equal((h.element('content').innerHTML.match(/class="watchlist-pending"/g)||[]).length,1);
  h.back();assert.match(h.element('content').innerHTML,/SIGMOD/);
  h.forward();assert.equal(h.run('state.category'),'lv');
  h.click({sourceProfile:'xun',sourceType:'lab'});assert.match(h.element('content').innerHTML,/Berkeley RAIL/);
  h.click({action:'sources'});assert.equal(h.run('state.view'),'feed');
  assert.equal(h.run('state.q'),'Gatterbauer');assert.equal(h.run('state.date'),'2026-10-31');
  for(let i=0;i<2;i++){h.click({action:'sources'});h.click({action:'sources'});}
  assert.equal(h.run('state.view'),'feed');
  h.run("go({category:'all',view:'sources'})");assert.match(h.element('content').innerHTML,/选择一个方向/);
  h.click({view:'bookmarks'});assert.equal(h.element('bookmark-transfer').hidden,false);
  h.click({view:'archive'});assert.equal(h.run('state.view'),'archive');
});


test('Each sidebar profile owns its focus child; parent returns to feed and child remains directly addressable',async()=>{
  const h=await appHarness(),html=await read('index.html'),css=await read('styles.css');
  assert.ok(!html.includes('source-toggle'));
  for(const category of ['xun','li','lv']){
    const nav=h.element('category-tabs').innerHTML;
    assert.match(nav,new RegExp('data-category="'+category+'"[\\s\\S]*?</button><div class="profile-subnav"><button[^>]*data-source-profile="'+category+'"'));
    h.click({sourceProfile:category});assert.equal(h.run('state.category'),category);assert.equal(h.run('state.view'),'sources');
    assert.match(h.element('category-tabs').innerHTML,new RegExp('data-source-profile="'+category+'"[^>]*aria-current="page"'));
    h.click({sourceProfile:category});assert.equal(h.run('state.view'),'sources');
    h.click({category});assert.equal(h.run('state.view'),'feed');
    h.back();assert.equal(h.run('state.view'),'sources');
  }
  h.events['rail-toggle:click']();h.click({sourceProfile:'li'});
  assert.match(h.element('category-tabs').innerHTML,/aria-label="李的会议"/);
  assert.equal(h.run('state.view'),'sources');
  assert.ok(css.includes('.rail-collapsed .focus-label{display:none}'));
  assert.ok(!h.element('content').innerHTML.includes('关注来源'));
});

test('Nine sidebar destinations show exactly one section, repeat safely and restore history',async()=>{
  const h=await appHarness();
  h.run("go({q:'robot',date:'2026-10-31'})");
  for(const category of ['xun','li','lv'])for(const [type,label] of [['conference','会议'],['journal','期刊'],['lab','实验室']]){
    h.click({sourceProfile:category,sourceType:type});
    assert.equal(h.run('state.category'),category);assert.equal(h.run('state.sourceType'),type);
    assert.equal((h.element('content').innerHTML.match(/class="watchlist-section"/g)||[]).length,1);
    assert.equal(h.element('result-count').textContent,'');
    assert.match(h.element('content').innerHTML,new RegExp(' · '+label));
    assert.equal((h.element('category-tabs').innerHTML.match(/data-source-type=/g)||[]).length,9);
    assert.equal((h.element('category-tabs').innerHTML.match(/aria-current="page"/g)||[]).length,1);
    assert.ok(!h.element('category-tabs').innerHTML.includes('关注重点'));
    h.click({sourceProfile:category,sourceType:type});assert.equal(h.run('state.view'),'sources');
    h.click({category});assert.equal(h.run('state.view'),'feed');
    h.back();assert.equal(h.run('state.sourceType'),type);assert.equal(h.run('state.view'),'sources');
    h.forward();assert.equal(h.run('state.view'),'feed');
    assert.equal(h.run('state.q'),'robot');assert.equal(h.run('state.date'),'2026-10-31');
  }
});

test('Site copy stays concise without removing functional state or demo warnings',async()=>{
  const h=await appHarness(),html=await read('index.html');
  for(const text of ['同源 JSON','NO BACKEND / NO TRACKING','少一点信息过载','有依据的精选','每一天，都有迹可循','纯前端阅读站','signal-panel'])assert.ok(!html.includes(text),text);
  assert.ok(html.includes('书签、已读与笔记仅保存在本机，不会自动同步。'));
  h.click({sourceProfile:'xun',sourceType:'lab'});assert.equal(h.element('result-bar').hidden,true);
  h.click({category:'xun'});assert.equal(h.element('result-bar').hidden,false);
  assert.match(h.element('content').innerHTML,/预印本/);
  h.click({view:'archive'});assert.match(h.element('content').innerHTML,/2026/);
  h.click({view:'bookmarks'});assert.equal(h.element('bookmark-transfer').hidden,false);
  h.events['about-button:click']();
  assert.ok(!h.element('dialog-content').innerHTML.includes('JSON'));
  assert.ok(!h.element('dialog-content').innerHTML.includes('纯前端'));
  assert.ok(h.element('dialog-content').innerHTML.includes('清除浏览器数据会删除记录'));
  h.element('detail-dialog').close();h.click({category:'all'});h.click({action:'demo'});
  assert.equal(h.element('demo-banner').hidden,false);
  assert.match(h.element('content').innerHTML,/演示数据，非真实论文/);
});

test('Exact profile mottos appear only below their real daily feed heading without blank placeholders',async()=>{
  const h=await appHarness(),html=await read('index.html'),css=await read('styles.css');
  assert.match(html,/<\/h2><p id="profile-motto" class="profile-motto" hidden><\/p>/);
  assert.match(css,/\[hidden\]\{display:none!important\}/);
  const motto=h.element('profile-motto');
  assert.equal(motto.hidden,true);assert.equal(motto.textContent,'');
  for(const [category,text] of [['xun','我会成为机器人发展史上不可跨过的人物吗'],['li','As Always'],['lv','年入百万，迎娶🇨🇦姐姐，我只是想给她一个中国户口'],['all','']]){
    h.click({category});assert.equal(motto.textContent,text);assert.equal(motto.hidden,!text);
  }
  h.click({category:'xun'});h.click({category:'li'});
  h.back();assert.equal(motto.textContent,'我会成为机器人发展史上不可跨过的人物吗');
  h.forward();assert.equal(motto.textContent,'As Always');assert.equal(motto.attributes.lang,'en');
  for(const view of ['archive','bookmarks']){h.click({view});assert.equal(motto.hidden,true);assert.equal(motto.textContent,'');}
  for(const sourceType of ['conference','journal','lab']){h.click({sourceProfile:'xun',sourceType});assert.equal(motto.hidden,true);assert.equal(motto.textContent,'');}
  h.click({category:'xun'});assert.equal(motto.hidden,false);
  h.click({action:'demo'});assert.equal(motto.hidden,true);assert.equal(motto.textContent,'');
  h.run("go({demo:false,view:'feed',category:'lv'})");assert.equal(motto.hidden,false);assert.equal(motto.textContent,'年入百万，迎娶🇨🇦姐姐，我只是想给她一个中国户口');
  assert.equal(motto.attributes['data-profile'],'lv');assert.equal(motto.attributes.lang,'zh-CN');
  for(const sourceType of ['conference','journal','lab']){h.click({sourceProfile:'lv',sourceType});assert.equal(motto.hidden,true);assert.equal(motto.attributes['data-profile'],'');}
  h.click({category:'lv'});assert.equal(motto.attributes['data-profile'],'lv');
  for(const view of ['archive','bookmarks']){h.click({view});assert.equal(motto.hidden,true);assert.equal(motto.textContent,'');}
  h.click({view:'feed'});assert.equal(motto.hidden,false);
  h.click({category:'li'});assert.equal(motto.attributes['data-profile'],'li');assert.equal(motto.textContent,'As Always');
  h.back();assert.equal(motto.attributes['data-profile'],'lv');assert.equal(motto.hidden,false);
  h.forward();assert.equal(motto.attributes['data-profile'],'li');
  assert.match(css,/\.profile-motto\[data-profile\]\{[^}]*font-size:clamp\(18px,2vw,23px\)[^}]*font-weight:750/);
  assert.match(css,/\.profile-motto\[data-profile\]\{[^}]*--motto-color:#175cd3/);
  assert.match(css,/\.profile-motto\[data-profile="li"\]\{--motto-color:#b42318/);
  assert.match(css,/\.profile-motto\[data-profile="lv"\]\{--motto-color:#111827/);
  for(const category of ['xun','li','lv']){h.click({category});assert.equal(motto.attributes['data-profile'],category);assert.equal(motto.hidden,false);}
  h.click({category:'all'});assert.equal(motto.hidden,true);assert.equal(motto.attributes['data-profile'],'');
});
