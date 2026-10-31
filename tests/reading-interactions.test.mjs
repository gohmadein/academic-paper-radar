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
import * as sharing from '../lib/paper-share.js';
import * as media from '../lib/paper-media.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

// Exercise the real app event handlers and routing without a browser. This is
// intentionally not a layout, native dialog focus-trap, or browser-history test.
async function harness({navigator={}}={}) {
  const elements=new Map(),listeners=new Map(),windowEvents={},stored=new Map(),entries=[''];
  const location={hash:'',href:'https://example.org/academic-paper-radar/?private=secret'};
  let position=0,context;
  const on=(key,fn)=>listeners.set(key,[...(listeners.get(key)||[]),fn]);
  const fire=(key,event={})=>Promise.all((listeners.get(key)||[]).map(fn=>fn(event)));
  const make=(id,dataset={})=>({id,dataset,hidden:false,value:'',textContent:'',tagName:'BUTTON',childNodes:[{textContent:''}],attributes:{},isConnected:true,open:false,
    classList:{toggle(){},add(){},remove(){}},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]},
    addEventListener(type,fn){on(id+':'+type,fn)},focus(){context.document.activeElement=this},select(){this.selected=true},
    showModal(){this.open=true},close(){this.open=false},closest(){return null},querySelector(){return null},getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100}},
    insertAdjacentHTML(_where,html){this._html=(this._html||'')+html},
    get innerHTML(){return this._html||''},set innerHTML(html){this._html=html;if(id==='content'&&context?.document.activeElement?.dataset?.paperControl)context.document.activeElement.isConnected=false;}
  });
  const element=id=>{if(!elements.has(id))elements.set(id,make(id));return elements.get(id)};
  const query=selector=>{const match=selector.match(/\[data-([\w-]+)="([^"]+)"\]/);if(!match)return null;const key=match[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return make(selector,{[key]:match[2],paperControl:true})};
  context=vm.createContext({...profileIcons,...sources,...topics,...model,...digest,...institutions,...transfer,...sharing,...media,
    navigator,e:model.escapeHTML,updateHUD(){},console,URL,URLSearchParams,CSS:{escape:x=>x},setTimeout:()=>0,clearTimeout(){},
    document:{title:'ZERO FIELD',getElementById:element,querySelectorAll:()=>[],querySelector:query,activeElement:make('body'),body:{classList:{toggle(){}}},addEventListener:(type,fn)=>on(type,fn)},
    window:{addEventListener:(type,fn)=>{windowEvents[type]=fn}},localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},location,
    history:{pushState(_a,_b,hash){entries.splice(++position);entries.push(hash);location.hash=hash},replaceState(_a,_b,hash){entries[position]=hash;location.hash=hash}},
    fetch:async url=>({ok:true,json:async()=>JSON.parse(await readFile(url,'utf8'))})});
  const source=(await read('app.js')).replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',JSON.stringify(new URL('../app.js',import.meta.url).href)).replace('\ninit();','\nglobalThis.boot=init();');
  vm.runInContext(source,context);await context.boot;
  const run=code=>vm.runInContext(code,context);
  return {element,run,fire,stored,location,make,click:async dataset=>{const button=make('clicked',{...dataset,paperControl:true});button.focus();await fire('click',{target:{closest:()=>button}});return button},
    back(){location.hash=entries[--position];windowEvents.popstate()},forward(){location.hash=entries[++position];windowEvents.popstate()}};
}

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};

test('Real delegated handlers keep repeated bookmark/read actions local and never open detail',async()=>{
  const h=await harness(),id=h.run('data.real.papers[0].id');
  for(let i=0;i<4;i++){
    await h.click({bookmark:id});assert.equal(h.run(`bookmarks.has(${JSON.stringify(id)})`),i%2===0);
    assert.equal(h.run('state.paper'),'');assert.equal(h.element('detail-dialog').open,false);
    await h.click({read:id});assert.equal(h.run(`reads.has(${JSON.stringify(id)})`),i%2===0);
    assert.equal(h.run('state.paper'),'');assert.equal(h.element('detail-dialog').open,false);
  }
  assert.deepEqual(JSON.parse(h.stored.get('paper-signal-bookmarks-v1')),[]);
  assert.deepEqual(JSON.parse(h.stored.get('paper-signal-read-v1')),[]);
});

test('Detail repeated open, Close, Escape and backdrop restore route and trigger; Back/Forward remains usable',async()=>{
  const h=await harness(),id=h.run('data.real.papers[0].id');
  for(const close of ['close-dialog:click','detail-dialog:cancel','detail-dialog:click']){
    const trigger=await h.click({paper:id});
    assert.equal(h.element('detail-dialog').open,true);assert.equal(h.run('state.paper'),id);
    let prevented=false;
    await h.fire(close,{preventDefault(){prevented=true},target:h.element('detail-dialog'),clientX:150,clientY:150});
    assert.equal(h.element('detail-dialog').open,false);assert.equal(h.run('state.paper'),'');
    assert.equal(h.run('document.activeElement.id'),trigger.id);
    if(close.endsWith('cancel'))assert.equal(prevented,true);
  }
  await h.click({paper:id});await h.click({paper:id});assert.equal(h.element('detail-dialog').open,true);
  await h.fire('close-dialog:click');h.back();assert.equal(h.element('detail-dialog').open,true);
  h.forward();assert.equal(h.element('detail-dialog').open,false);
  await h.fire('about-button:click');assert.equal(h.element('detail-dialog').open,true);
  await h.fire('detail-dialog:cancel',{preventDefault(){}});assert.equal(h.element('detail-dialog').open,false);
  assert.equal(h.run('document.activeElement.id'),'about-button');
});

test('Share cancellation stays silent; manual fallback contains only public paper identity and can close/reopen',async()=>{
  let copied=false;
  const h=await harness({navigator:{share:async()=>{throw Object.assign(Error('cancel'),{name:'AbortError'})},clipboard:{writeText:async()=>{copied=true}}}}),id=h.run('data.real.papers[0].id');
  await h.run(`requestShare(${JSON.stringify(id)})`);assert.equal(copied,false);assert.equal(h.element('share-dialog').open,false);
  const manual=await harness(),paper=manual.run('data.real.papers[0].id');
  for(let i=0;i<2;i++){
    await manual.run(`requestShare(${JSON.stringify(paper)})`);
    assert.equal(manual.element('share-dialog').open,true);
    assert.ok(manual.element('share-url').value.includes(paper));assert.ok(!manual.element('share-url').value.includes('private'));
    assert.equal(manual.run('state.paper'),'');
    await manual.fire('share-close:click');assert.equal(manual.element('share-dialog').open,false);
  }
});

test('An older share fallback cannot overwrite a newer paper or reopen after navigation/dismissal',async()=>{
  const attempts=[];
  const h=await harness({navigator:{share:()=>{const d=deferred();attempts.push(d);return d.promise}}});
  const ids=h.run('data.real.papers.slice(0,2).map(p=>p.id)');
  const old=h.run(`requestShare(${JSON.stringify(ids[0])})`);
  const newer=h.run(`requestShare(${JSON.stringify(ids[1])})`);
  attempts[1].reject(Error('unsupported'));await newer;
  assert.equal(h.element('share-dialog').open,true);assert.ok(h.element('share-url').value.includes(ids[1]));
  attempts[0].reject(Error('unsupported'));await old;
  assert.ok(h.element('share-url').value.includes(ids[1]));
  await h.fire('share-close:click');
  const pending=h.run(`requestShare(${JSON.stringify(ids[0])})`);
  await h.click({view:'archive'});attempts[2].reject(Error('unsupported'));await pending;
  assert.equal(h.element('share-dialog').open,false);assert.equal(h.run('state.view'),'archive');
  await h.click({view:'feed'});
  const dismissed=h.run(`requestShare(${JSON.stringify(ids[0])})`);
  await h.fire('share-close:click');attempts[3].reject(Error('unsupported'));await dismissed;
  assert.equal(h.element('share-dialog').open,false);
  const historyPending=h.run(`requestShare(${JSON.stringify(ids[0])})`);
  h.back();attempts[4].reject(Error('unsupported'));await historyPending;
  assert.equal(h.element('share-dialog').open,false);
});

test('Read control focus survives rerender instead of falling back to the document',async()=>{
  const h=await harness(),id=h.run('data.real.papers[0].id');
  for(let i=0;i<3;i++){
    await h.click({read:id});
    assert.equal(h.run('document.activeElement.dataset.read'),id);
    assert.equal(h.run('document.activeElement.isConnected'),true);
  }
});

test('Bilingual guide expands independently, retains full CN then EN content, and preserves keyboard focus',async()=>{
  const h=await harness(),id=h.run('data.real.papers[0].id'),other=h.run('data.real.papers[1].id');
  const expanded=id=>h.run(`expandedGuides.has(${JSON.stringify(id)})`);
  for(let i=0;i<4;i++){
    await h.click({guideToggle:id});assert.equal(expanded(id),i%2===0);assert.equal(expanded(other),false);
    assert.equal(h.run('state.paper'),'');assert.equal(h.element('detail-dialog').open,false);
    assert.equal(h.run('document.activeElement.dataset.guideToggle'),id);assert.equal(h.run('document.activeElement.isConnected'),true);
    assert.match(h.element('content').innerHTML,new RegExp('data-guide-toggle="'+id+'"[^>]*aria-expanded="'+(i%2===0)+'"'));
  }
  await h.click({guideToggle:id});await h.click({bookmark:id});await h.click({read:id});assert.equal(expanded(id),true);
  await h.click({paper:id});await h.fire('close-dialog:click');assert.equal(expanded(id),true);
  const p=h.run('data.real.papers[0]'),html=h.element('content').innerHTML;
  assert.ok(html.includes(model.escapeHTML(p.summary)));assert.ok(html.includes(model.escapeHTML(p.summaryEn)));
  assert.ok(html.indexOf(model.escapeHTML(p.summary))<html.indexOf(model.escapeHTML(p.summaryEn)));
  await h.click({view:'archive'});await h.click({view:'feed'});assert.equal(expanded(id),true);
});
