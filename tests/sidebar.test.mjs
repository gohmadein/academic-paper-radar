import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as model from '../lib/model.js';
import * as digest from '../lib/digest-view.js';
import * as institutions from '../lib/institutions.js';
import * as transfer from '../lib/bookmark-transfer.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

async function appHarness(){
  const elements=new Map(),events={},windowEvents={},stored=new Map(),entries=[''],location={hash:''};
  let position=0;
  const element=id=>{
    if(!elements.has(id))elements.set(id,{id,hidden:false,value:'',innerHTML:'',textContent:'',dataset:{},childNodes:[{textContent:''}],classList:{toggle(){},add(){},remove(){}},setAttribute(){},removeAttribute(){},addEventListener(type,fn){events[id+':'+type]=fn},open:false,isConnected:true,focus(){},close(){this.open=false},showModal(){this.open=true}});
    return elements.get(id);
  };
  const context=vm.createContext({...model,...digest,...institutions,...transfer,
    e:model.escapeHTML,updateHUD(){},console,URL,URLSearchParams,CSS:{escape:x=>x},setTimeout,clearTimeout,
    document:{getElementById:element,querySelectorAll:()=>[],querySelector:()=>null,activeElement:null,body:{classList:{toggle(){}}},addEventListener:(type,fn)=>{events[type]=fn}},
    window:{addEventListener:(type,fn)=>{windowEvents[type]=fn}},
    localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},
    location,
    history:{pushState(_a,_b,hash){entries.splice(++position);entries.push(hash);location.hash=hash},replaceState(_a,_b,hash){entries[position]=hash;location.hash=hash}},
    fetch:async url=>({ok:true,json:async()=>JSON.parse(await readFile(url,'utf8'))})
  });
  let source=await read('app.js');
  source=source.replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',JSON.stringify(new URL('../app.js',import.meta.url).href)).replace('\ninit();','\nglobalThis.boot=init();');
  vm.runInContext(source,context);await context.boot;
  const run=code=>vm.runInContext(code,context);
  return {element,run,events,stored,click:dataset=>events.click({target:{closest:()=>({dataset})}}),
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
  assert.equal(count(),11);
  for(const [category,n] of [['xun',7],['li',2],['lv',2],['all',11],['li',2]]){
    h.click({category});assert.equal(count(),n);
    assert.match(h.element('category-tabs').innerHTML,new RegExp('data-category="'+category+'" aria-pressed="true"'));
  }
  h.back();assert.equal(h.run('state.category'),'all');assert.equal(count(),11);
  h.forward();assert.equal(h.run('state.category'),'li');assert.equal(count(),2);
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
