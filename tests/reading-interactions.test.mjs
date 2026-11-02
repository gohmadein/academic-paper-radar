import * as arxivBulletin from '../lib/arxiv-bulletin.js';
import * as calendarTaskModule from '../lib/calendar-tasks.js';
import * as calendar from '../lib/research-calendar.js';
import * as liBackground from '../lib/li-background.js';
import * as sideArt from '../lib/side-art.js';
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
import * as sharing from '../lib/paper-share.js';
import * as media from '../lib/paper-media.js';
import * as notes from '../lib/paper-notes.js';
import * as notesView from '../lib/notes-view.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

// Exercise the real app event handlers and routing without a browser. This is
// intentionally not a layout, native dialog focus-trap, or browser-history test.
async function harness({navigator={},storageFailure=false,storageEntries=[],hash='',bulletinData=null}={}) {
  const bodyClasses=new Set();
  const elements=new Map(),listeners=new Map(),windowEvents={},stored=new Map(storageEntries),entries=[hash];
  const location={hash,href:'https://example.org/academic-paper-radar/?private=secret'};
  let position=0,context,timerId=0;
  const timers=new Map();
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
  context=vm.createContext({...arxivBulletin,...calendarTaskModule,...calendar,...liBackground,...sideArt,...researchMap,...profileIcons,...sources,...topics,...model,...digest,...institutions,...transfer,...sharing,...media,...notes,...notesView,
    navigator,e:model.escapeHTML,updateHUD(){},console,URL,URLSearchParams,TextEncoder,CSS:{escape:x=>x},setTimeout:(fn)=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),
    document:{title:'ZERO FIELD',getElementById:element,querySelectorAll:()=>[],querySelector:query,activeElement:make('body'),body:{classList:{toggle(name,on){if(on)bodyClasses.add(name);else bodyClasses.delete(name)}}},addEventListener:(type,fn)=>on(type,fn)},
    window:{confirm:()=>true,addEventListener:(type,fn)=>{windowEvents[type]=fn}},localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>{if(storageFailure)throw Error('QuotaExceededError');stored.set(k,v)}},location,
    history:{pushState(_a,_b,hash){entries.splice(++position);entries.push(hash);location.hash=hash},replaceState(_a,_b,hash){entries[position]=hash;location.hash=hash}},
    fetch:async url=>({ok:true,json:async()=>bulletinData&&String(url).endsWith('/data/arxiv/days/2026-11-02.json')?structuredClone(bulletinData):JSON.parse(await readFile(url,'utf8'))})});
  const source=(await read('app.js')).replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',JSON.stringify(new URL('../app.js',import.meta.url).href)).replace('\ninit();','\nglobalThis.boot=init();');
  vm.runInContext(source,context);await context.boot;
  const run=code=>vm.runInContext(code,context);
  return {bodyClasses,element,run,fire,stored,location,make,windowEvents,runTimers(){const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();},click:async dataset=>{const button=make('clicked',{...dataset,paperControl:true});button.focus();await fire('click',{target:{closest:()=>button}});return button},
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

test('Atlas repeated modes, selection, close, paper detail and profile/navigation do not change feed filters',async()=>{
 const h=await harness();
 h.run("go({category:'xun',q:'not-a-match',date:'2026-10-30'})");
 const region=h.run("researchMapModel(data.real.papers,data.geography,{profile:'xun'}).groups[0].id");
 const id=h.run("researchMapModel(data.real.papers,data.geography,{profile:'xun'}).groups[0].papers[0].id");
 for(let i=0;i<3;i++){
  await h.click({mapMode:'today'});assert.equal(h.run('mapMode'),'today');
  await h.click({mapMode:'all'});assert.equal(h.run('mapMode'),'all');
  await h.click({mapRegion:region});assert.equal(h.run('mapRegion'),region);assert.match(h.element('research-map').innerHTML,/data-map-paper/);
  await h.click({mapPaper:id});assert.equal(h.element('detail-dialog').open,true);assert.equal(h.run('state.date'),'2026-10-30');
  await h.fire('close-dialog:click');assert.equal(h.element('detail-dialog').open,false);assert.equal(h.run('state.q'),'not-a-match');
  await h.click({mapClear:'true'});assert.equal(h.run('mapRegion'),'');
 }
 await h.click({mapRegion:region});await h.click({category:'li'});assert.equal(h.run('mapRegion'),'');
 for(const view of ['archive','bookmarks','sources']){h.run(`go({view:'${view}'})`);assert.equal(h.element('research-map').hidden,true);}
 h.run("go({view:'feed',demo:true})");assert.equal(h.element('research-map').hidden,true);
 h.run("go({view:'feed',demo:false,category:'all'})");assert.equal(h.element('research-map').hidden,false);
});

test('Notes autosave multiline plain text, do not open detail, and retain draft on repeated open and switching IDs',async()=>{
  const h=await harness(),ids=h.run('data.real.papers.slice(0,2).map(p=>p.id)');
  const text='想法\n</textarea><img src=x onerror=alert(1)>\n第二行';
  await h.click({note:ids[0]});assert.equal(h.element('notes-dialog').open,true);assert.equal(h.element('detail-dialog').open,false);
  assert.equal(h.run('document.activeElement.id'),'notes-text');
  h.element('notes-text').value=text;await h.fire('notes-text:input');assert.match(h.element('notes-status').textContent,/正在保存/);
  assert.equal(h.stored.has(notes.NOTES_KEY),false);
  await h.click({note:ids[0]});assert.equal(h.element('notes-text').value,text);
  h.runTimers();assert.match(h.element('notes-status').textContent,/已保存到本机/);
  assert.equal(notes.parseNotesImport(h.stored.get(notes.NOTES_KEY)).get(ids[0]),text);
  h.element('notes-text').value='latest draft';await h.fire('notes-text:input');
  await h.click({note:ids[1]});assert.equal(h.element('notes-text').value,'');
  assert.equal(notes.parseNotesImport(h.stored.get(notes.NOTES_KEY)).get(ids[0]),'latest draft');
  await h.click({note:ids[0]});assert.equal(h.element('notes-text').value,'latest draft');
  assert.ok(!h.element('content').innerHTML.includes('onerror=alert(1)'));assert.equal(h.run('state.paper'),'');
});

test('Notes Close, Escape and backdrop flush immediately and restore focus; detail is suspended not stacked',async()=>{
  const h=await harness(),id=h.run('data.real.papers[0].id');
  for(const close of ['notes-close:click','notes-dialog:cancel','notes-dialog:click']){
    const trigger=await h.click({note:id});h.element('notes-text').value=close;await h.fire('notes-text:input');
    let prevented=false;await h.fire(close,{preventDefault(){prevented=true},target:h.element('notes-dialog'),clientX:150,clientY:150});
    assert.equal(h.element('notes-dialog').open,false);assert.equal(h.run('document.activeElement.id'),trigger.id);
    assert.equal(notes.parseNotesImport(h.stored.get(notes.NOTES_KEY)).get(id),close);
    if(close.endsWith('cancel'))assert.equal(prevented,true);
  }
  await h.click({paper:id});assert.equal(h.element('detail-dialog').open,true);
  await h.click({note:id});assert.equal(h.element('detail-dialog').open,false);assert.equal(h.element('notes-dialog').open,true);
  await h.fire('notes-close:click');assert.equal(h.element('notes-dialog').open,false);assert.equal(h.element('detail-dialog').open,true);
  assert.equal(h.run('state.paper'),id);await h.fire('close-dialog:click');assert.equal(h.run('state.paper'),'');
});

test('Notes flush on navigation and lifecycle; stored IDs persist across profiles, archives and search',async()=>{
  const h=await harness(),id=h.run('data.real.papers[0].id');
  for(const patch of [{category:'li'},{view:'archive'},{view:'feed',q:'search'}]){
    await h.click({note:id});h.element('notes-text').value=JSON.stringify(patch);await h.fire('notes-text:input');
    h.run(`go(${JSON.stringify(patch)})`);assert.equal(h.element('notes-dialog').open,false);
    assert.equal(notes.parseNotesImport(h.stored.get(notes.NOTES_KEY)).get(id),JSON.stringify(patch));
  }
  await h.click({note:id});assert.equal(h.element('notes-text').value,JSON.stringify({view:'feed',q:'search'}));
  for(const event of ['pagehide','beforeunload']){
    h.element('notes-text').value=event;await h.fire('notes-text:input');h.windowEvents[event]({preventDefault(){}});
    assert.equal(notes.parseNotesImport(h.stored.get(notes.NOTES_KEY)).get(id),event);
  }
  h.element('notes-text').value='hidden';await h.fire('notes-text:input');h.run('document.hidden=true');await h.fire('visibilitychange');
  assert.equal(notes.parseNotesImport(h.stored.get(notes.NOTES_KEY)).get(id),'hidden');
});

test('Failed autosave is honest, retains draft after close/navigation and warns on unload',async()=>{
  const h=await harness({storageFailure:true}),id=h.run('data.real.papers[0].id');
  await h.click({note:id});h.element('notes-text').value='do not lose';await h.fire('notes-text:input');h.runTimers();
  assert.match(h.element('notes-status').textContent,/尚未保存/);assert.equal(h.stored.has(notes.NOTES_KEY),false);
  await h.fire('notes-close:click');assert.match(h.element('toast').textContent,/未保存/);
  await h.click({view:'archive'});await h.click({note:id});assert.equal(h.element('notes-text').value,'do not lose');
  let prevented=false;const event={preventDefault(){prevented=true}};h.windowEvents.beforeunload(event);
  assert.equal(prevented,true);assert.equal(event.returnValue,'');assert.equal(h.run('notes.dirty'),true);
});

test('Notes import skips conflicts, keeps active unsaved draft, and rejects old bookmark JSON without changing it',async()=>{
  const h=await harness(),id=h.run('data.real.papers[0].id');await h.click({note:id});
  h.element('notes-text').value='active draft';await h.fire('notes-text:input');
  h.element('notes-import-json').value=notes.makeNotesExport(new Map([[id,'different'],['unknown-paper','new']]));
  await h.fire('notes-import-pasted:click');assert.equal(h.element('notes-text').value,'active draft');
  assert.match(h.element('notes-transfer-status').textContent,/跳过 1/);
  assert.equal(notes.parseNotesImport(h.stored.get(notes.NOTES_KEY)).get('unknown-paper'),'new');
  h.element('notes-import-json').value=JSON.stringify(transfer.makeBookmarkExport(new Set([id])));await h.fire('notes-import-pasted:click');
  assert.match(h.element('notes-transfer-status').textContent,/导入失败/);assert.equal(h.element('notes-text').value,'active draft');
});

test('Notes deletion requires confirmation and affects only the active paper',async()=>{
  const h=await harness(),ids=h.run('data.real.papers.slice(0,2).map(p=>p.id)');
  for(const id of ids){await h.click({note:id});h.element('notes-text').value=id;await h.fire('notes-text:input');await h.fire('notes-close:click');}
  await h.click({note:ids[0]});h.run('window.confirm=()=>false');await h.fire('notes-delete:click');assert.equal(h.element('notes-text').value,ids[0]);
  h.run('window.confirm=()=>true');await h.fire('notes-delete:click');assert.equal(h.element('notes-text').value,'');
  const stored=notes.parseNotesImport(h.stored.get(notes.NOTES_KEY));assert.equal(stored.has(ids[0]),false);assert.equal(stored.get(ids[1]),ids[1]);
  assert.equal(h.run('document.activeElement.id'),'notes-text');
});

test('Note content never enters public sharing or card HTML; note labels escape paper metadata',async()=>{
  const h=await harness(),id=h.run('data.real.papers[0].id');await h.click({note:id});
  h.element('notes-text').value='VERY_PRIVATE_NOTE_123';await h.fire('notes-text:input');await h.fire('notes-close:click');
  await h.click({share:id});assert.equal(h.element('share-dialog').open,true);assert.ok(!h.element('share-url').value.includes('VERY_PRIVATE_NOTE_123'));
  assert.ok(!h.element('content').innerHTML.includes('VERY_PRIVATE_NOTE_123'));
  const html=notesView.noteButton({id:'x" onclick="bad',title:'<script>bad</script>'},true);
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('data-note="x" onclick='));
  assert.match(await read('index.html'),/id="notes-text"[^>]*maxlength="10000"/);
});

test('Background bookmark refresh cannot reopen suspended detail over the note editor',async()=>{
  const h=await harness(),id=h.run('data.real.papers[0].id');
  await h.click({paper:id});await h.click({note:id});h.element('notes-text').value='in progress';await h.fire('notes-text:input');
  h.windowEvents.storage({key:'paper-signal-bookmarks-v1',newValue:JSON.stringify([id])});
  assert.equal(h.element('notes-dialog').open,true);assert.equal(h.element('detail-dialog').open,false);
  assert.equal(h.element('notes-text').value,'in progress');
});

test('Shared glass follows real feeds while Li photographs remain exclusive across navigation',async()=>{
 const h=await harness();
 for(const category of ['xun','li','lv','all']){
   await h.click({category});
   assert.ok(h.bodyClasses.has('feed-glass'),category);
   assert.equal(h.bodyClasses.has('li-glass'),category==='li');
 }
 for(const view of ['archive','bookmarks','sources']){
   h.run(`go({view:'${view}',category:'li'})`);
   assert.equal(h.bodyClasses.has('feed-glass'),false,view);
   assert.equal(h.bodyClasses.has('li-glass'),false,view);
 }
 h.run("go({view:'feed',category:'li',demo:true})");
 assert.equal(h.bodyClasses.has('feed-glass'),false);
 assert.equal(h.bodyClasses.has('li-glass'),false);
 h.run("go({demo:false})");
 assert.ok(h.bodyClasses.has('feed-glass'));
 assert.ok(h.bodyClasses.has('li-glass'));
});

test('Private calendar create/edit/complete/delete stays local and keeps paper state unchanged',async()=>{
 const h=await harness(),route=h.location.hash;
 await h.click({calendarTaskAdd:'2026-11-05'});h.element('calendar-task-text').value='<img src=x> synthetic task';
 await h.fire('calendar-task-save:click');
 assert.equal(h.element('calendar-task-dialog').open,false);
 const task=h.run('calendarTasks.list()[0]');assert.equal(task.date,'2026-11-05');
 assert.equal(JSON.parse(h.stored.get(calendarTaskModule.CALENDAR_TASKS_KEY)).tasks.length,1);
 await h.click({calendarTaskToggle:task.id});assert.equal(h.run('calendarTasks.list()[0].done'),true);
 await h.click({calendarTaskEdit:task.id});h.element('calendar-task-date').value='2026-11-06';
 await h.fire('calendar-task-cancel:click');assert.equal(h.run('calendarEditorDraft.date'),'2026-11-06');
 await h.click({calendarTaskEdit:task.id});assert.equal(h.element('calendar-task-date').value,'2026-11-06');await h.fire('calendar-task-save:click');
 assert.equal(h.run('calendarTasks.list()[0].date'),'2026-11-06');
 await h.click({calendarTaskDelete:task.id});assert.equal(h.run('calendarTasks.list().length'),0);assert.equal(h.location.hash,route);
});

test('Calendar save failure retains text/draft and warns on unload; public refresh preserves editor',async()=>{
 const h=await harness({storageFailure:true});await h.click({calendarTaskAdd:'2026-11-07'});
 h.element('calendar-task-text').value='unsaved synthetic draft';await h.fire('calendar-task-save:click');
 assert.equal(h.element('calendar-task-dialog').open,true);assert.match(h.element('calendar-task-status').textContent,/尚未保存/);
 let warned=false;h.windowEvents.beforeunload({preventDefault(){warned=true}});assert.ok(warned);
 h.run('calendarLastAttempt=0;');await h.run('refreshCalendarData(true)');
 assert.equal(h.element('calendar-task-text').value,'unsaved synthetic draft');assert.equal(h.element('calendar-task-dialog').open,true);
 h.run('fetch=async()=>{throw Error("offline")};calendarLastAttempt=0');const before=h.run('calendarData');await h.run('refreshCalendarData(true)');
 assert.equal(h.run('calendarData'),before);assert.match(h.run('calendarRefreshError'),/保留/);
});

test('Profile calendar navigation isolates tasks and resumes only its own editor draft',async()=>{
 const h=await harness();await h.click({category:'xun'});
 await h.click({calendarTaskAdd:'2026-11-05'});h.element('calendar-task-text').value='Xun draft';
 await h.click({category:'li'});assert.equal(h.element('calendar-task-dialog').open,false);assert.equal(h.run('calendarTasks.list().length'),0);
 await h.click({calendarTaskAdd:'2026-11-05'});assert.equal(h.element('calendar-task-text').value,'');h.element('calendar-task-text').value='Li only';await h.fire('calendar-task-save:click');
 assert.equal(h.run('calendarTasks.list()[0].text'),'Li only');assert.ok(h.stored.has(calendarTaskModule.calendarTaskKey('li')));assert.ok(!h.stored.has(calendarTaskModule.CALENDAR_TASKS_KEY));
 await h.click({category:'lv'});assert.equal(h.run('calendarTasks.list().length'),0);assert.equal(h.run('calendarEditorDraft'),null);
 await h.click({category:'xun'});await h.click({calendarTaskAdd:'2026-11-06'});assert.equal(h.element('calendar-task-text').value,'Xun draft');assert.equal(h.element('calendar-task-date').value,'2026-11-05');
 await h.fire('calendar-task-save:click');assert.equal(h.run('calendarTasks.list()[0].text'),'Xun draft');
 await h.click({category:'li'});assert.equal(h.run('calendarTasks.list()[0].text'),'Li only');assert.equal(h.run('calendarEditorDraft'),null);
});

test('A closed profile draft is not silently rebased on another tab write',async()=>{
 const h=await harness();await h.click({category:'xun'});await h.click({calendarTaskAdd:'2026-11-06'});h.element('calendar-task-text').value='Keep draft';await h.click({category:'li'});
 h.stored.set(calendarTaskModule.CALENDAR_TASKS_KEY,calendarTaskModule.makeCalendarTasksExport([{id:'task-other',date:'2026-11-06',text:'Other tab',done:false,updatedAt:'2026-11-02T00:00:00.000Z'}]));
 h.windowEvents.storage({key:calendarTaskModule.CALENDAR_TASKS_KEY});await h.click({category:'xun'});await h.click({calendarTaskAdd:'2026-11-06'});await h.fire('calendar-task-save:click');
 assert.match(h.element('calendar-task-status').textContent,/标签页/);assert.equal(h.element('calendar-task-text').value,'Keep draft');assert.equal(JSON.parse(h.stored.get(calendarTaskModule.CALENDAR_TASKS_KEY)).tasks[0].text,'Other tab');
});

test('Calendar backup text and status stay within their owning profile',async()=>{
 const h=await harness();await h.click({category:'li'});h.element('calendar-task-backup-text').value='Li backup buffer';h.element('calendar-task-transfer-status').textContent='Li result';
 await h.click({category:'lv'});assert.equal(h.element('calendar-task-backup-text').value,'');assert.equal(h.element('calendar-task-transfer-status').textContent,'');
 h.element('calendar-task-backup-text').value='Lv buffer';await h.click({category:'li'});assert.equal(h.element('calendar-task-backup-text').value,'Li backup buffer');assert.equal(h.element('calendar-task-transfer-status').textContent,'Li result');
});

test('Xun bulletin is separate from curated routes and stale archive requests cannot replace newer choices',async()=>{
 const h=await harness(),day=JSON.parse(await read('data/arxiv/days/2026-11-02.json'));await h.click({category:'xun'});const route=h.location.hash;
 // Let any initial refresh settle before installing the deterministic transport.
 await h.run('refreshArxivBulletin()');
 const later=structuredClone(day);later.date='2026-11-03';const wait=deferred();
 h.run('arxivLoading=false');h.run('arxivIndex=null');
 h.run('globalThis.testTransport={};');h.run('testTransport').index={version:1,days:[{date:'2026-11-03',file:'days/2026-11-03.json',count:later.entries.length,status:later.status},{date:'2026-11-02',file:'days/2026-11-02.json',count:day.entries.length,status:day.status}]};
 h.run('testTransport').later=later;h.run('testTransport').pending=wait.promise;
 h.run("fetch=async url=>({ok:true,json:async()=>String(url).includes('index.json')?testTransport.index:String(url).endsWith('/2026-11-02.json')?await testTransport.pending:testTransport.later})");
 const old=h.run("refreshArxivBulletin('2026-11-02')");await Promise.resolve();const newest=h.run("refreshArxivBulletin('2026-11-03')");await newest;wait.resolve(day);await old;
 assert.equal(h.run('arxivLoadedDate'),'2026-11-03');assert.equal(h.run('arxivDay.date'),'2026-11-03');assert.equal(h.location.hash,route);
 h.run("fetch=async()=>{throw Error('offline')}");await h.run('refreshArxivBulletin()');assert.match(h.run('arxivError'),/上次/);assert.equal(h.run('arxivDay.date'),'2026-11-03');
 for(const category of ['li','lv','all']){await h.click({category});assert.equal(h.element('arxiv-updates').hidden,true);}
 await h.click({category:'xun'});assert.equal(h.element('arxiv-updates').hidden,false);await h.click({view:'archive'});assert.equal(h.element('arxiv-updates').hidden,true);
});

function testBulletinGuide(entry){return {titleZh:'测试机器人研究',summaryZh:'该研究依据作者摘要讨论机器人任务中的方法设计与性能评估，关注任务假设及其适用范围。'.repeat(3),summaryEn:'This guide is based on the author abstract and discusses methods and reported evaluation in robot tasks, with attention to assumptions and the scope of applicability.',whyRead:'了解机器人方法',relation:'机器人研究',prerequisites:['控制基础'],difficulty:'intermediate',readRecommendation:'read',tags:['机器人'],limits:['摘要未给出完整实验设置'],assumptions:['尚未核读正文'],readingAdvice:['先读摘要，再核对正文实验设置'],links:{code:null,project:null,video:null,data:null},evidence:[{url:entry.url,claim:'作者摘要与官方元数据',checkedAt:'2026-11-02'}]};}
async function installGuidedBulletin(h){const day=JSON.parse(await read('data/arxiv/days/2026-11-02.json'));day.entries.forEach(entry=>entry.guide=testBulletinGuide(entry));h.run(`arxivArchive.set(${JSON.stringify(day.date)},${JSON.stringify(day)});arxivDay=arxivArchive.get(${JSON.stringify(day.date)});arxivLoadedDate=${JSON.stringify(day.date)};arxivIndex={version:1,days:[{date:${JSON.stringify(day.date)},file:'days/2026-11-02.json',count:142,status:'complete'}]}`);return day;}

test('Rich bulletin is below curated cards; all entries reuse bilingual cards without figure placeholders',async()=>{
 const html=await read('index.html');assert.ok(html.indexOf('id="arxiv-updates"')>html.indexOf('id="content"'));assert.ok(html.indexOf('id="arxiv-updates"')<html.indexOf('id="institution-gallery"'));
 const h=await harness(),day=await installGuidedBulletin(h);await h.click({category:'xun'});const markup=h.element('arxiv-updates').innerHTML;
 assert.equal((markup.match(/class="paper-card /g)||[]).length,142);assert.match(markup,/中文导读/);assert.match(markup,/ENGLISH GUIDE/);assert.match(markup,/data-note=/);assert.match(markup,/data-read=/);assert.match(markup,/data-share=/);assert.doesNotMatch(markup,/paper-figure|figure-fallback|editorial-visual/);assert.match(markup,/bulletin-guide-/);assert.equal(h.run('collection().papers.length'),h.run('data.real.papers.length'));
 const id=day.entries[0].id;await h.click({paper:id});assert.equal(h.element('detail-dialog').open,true);assert.match(h.element('dialog-content').innerHTML,/摘要级阅读/);assert.doesNotMatch(h.element('dialog-content').innerHTML,/paper-figure/);
});

test('Bulletin notes/read/bookmarks share stable IDs, survive archive selection, and do not inflate curated collections',async()=>{
 const h=await harness(),day=await installGuidedBulletin(h),id=day.entries[0].id;await h.click({category:'xun'});const curated=h.run('data.real.papers.length');
 await h.click({bookmark:id});await h.click({read:id});await h.click({note:id});assert.equal(h.element('notes-dialog').open,true);h.element('notes-text').value='Synthetic local bulletin note';await h.fire('notes-text:input');h.run('closeNotes(false)');assert.equal(h.run(`notes.get('${id}')`),'Synthetic local bulletin note');
 await h.click({view:'bookmarks'});assert.match(h.element('content').innerHTML,/测试机器人研究/);assert.equal(h.run(`reads.has('${id}')`),true);assert.equal(h.run('data.real.papers.length'),curated);
 h.run("arxivDay=null;arxivLoadedDate='2026-11-03'");await h.click({paper:id});assert.equal(h.element('detail-dialog').open,true);assert.equal(h.run(`readingPaper('${id}').id`),id);
 // Curated identity is preferred in bookmarks, without duplicate records or new local IDs.
 h.run(`data.real.papers.push({...readingPaper('${id}'),bulletin:false,date:'2026-10-31',title:'Canonical curated record'})`);assert.equal(h.run(`allReadingPapers().filter(p=>p.id==='${id}').length`),1);assert.equal(h.run(`allReadingPapers().find(p=>p.id==='${id}').title`),'Canonical curated record');assert.equal(h.run(`readingPaper('${id}',{date:'2026-11-02'}).title`),'Canonical curated record');assert.equal(h.run(`notes.get('${id}')`),'Synthetic local bulletin note');
});


test('Bookmarked bulletin records and shared deep links hydrate from public archive after reload',async()=>{
 const day=JSON.parse(await read('data/arxiv/days/2026-11-02.json'));day.entries.forEach(entry=>entry.guide=testBulletinGuide(entry));const id=day.entries[0].id;
 const first=await harness({bulletinData:day});await first.click({category:'xun'});await first.click({bookmark:id});await first.click({read:id});await first.click({note:id});first.element('notes-text').value='Local durable test';await first.fire('notes-text:input');first.run('closeNotes(false)');
 const hash=first.run(`new URL(publicPaperURL(location.href,readingPaper('${id}'))).hash`);assert.match(hash,/category=xun/);
 const reloaded=await harness({bulletinData:day,storageEntries:[...first.stored],hash});assert.equal(reloaded.element('detail-dialog').open,true);assert.equal(reloaded.run(`notes.get('${id}')`),'Local durable test');assert.equal(reloaded.run(`reads.has('${id}')`),true);
 await reloaded.click({view:'bookmarks'});assert.match(reloaded.element('content').innerHTML,/测试机器人研究/);assert.equal(reloaded.element('bookmark-count').textContent,1);
});


test('Older bulletin actions preserve selected announcement date without moving the curated filter',async()=>{
 const h=await harness(),day=await installGuidedBulletin(h),id=day.entries[0].id;await h.click({category:'xun'});
 const old=structuredClone(day);old.date='2026-11-01';old.entries[0].guide.titleZh='较早公告的导读';old.entries[0].version=1;old.entries[0].url='https://arxiv.org/abs/'+old.entries[0].arxivId+'v1';old.entries[0].guide.evidence[0].url=old.entries[0].url;
 h.run(`arxivArchive.set('2026-11-01',${JSON.stringify(old)});arxivDay=arxivArchive.get('2026-11-01');arxivLoadedDate='2026-11-01'`);const date=h.run('state.date');
 await h.click({paper:id,bulletinDate:'2026-11-01'});assert.match(h.element('dialog-content').innerHTML,/较早公告的导读/);assert.equal(h.run('state.date'),date);assert.match(h.location.hash,/bulletin=2026-11-01/);
 await h.click({paper:id,bulletinDate:'2026-11-02'});assert.doesNotMatch(h.element('dialog-content').innerHTML,/较早公告的导读/);await h.click({paper:id,bulletinDate:'2026-11-01'});assert.match(h.element('dialog-content').innerHTML,/较早公告的导读/);await h.fire('detail-close:click');await h.click({share:id,bulletinDate:'2026-11-01'});assert.match(h.element('share-url').value,/bulletin=2026-11-01/);assert.match(h.element('share-url').value,/date=2026-11-01/);assert.equal(h.run('state.date'),date);
 h.run('data=null');assert.equal(h.run(`readingPaper('${id}')`),null);h.run('lastArxivMarkup="";renderArxivBulletin()');assert.doesNotMatch(h.element('arxiv-updates').innerHTML,/data-note=/);
});
