import test from 'node:test';
import assert from 'node:assert/strict';
import {CALENDAR_TASKS_KEY,MAX_TASK_LENGTH,MAX_CALENDAR_TASKS,MAX_CALENDAR_TASKS_BYTES,createCalendarTaskStore,makeCalendarTasksExport,parseCalendarTasksImport,mergeCalendarTasks} from '../lib/calendar-tasks.js';
const stamp='2026-11-01T08:00:00.000Z';
const task=(id='task-one',date='2026-11-01',text='完成实验')=>({id,date,text,done:false,updatedAt:stamp});
function memory(raw=null){let value=raw,failRead=false,failWrite=false,writes=0;const storage={getItem(key){assert.equal(key,CALENDAR_TASKS_KEY);if(failRead)throw Error('blocked');return value;},setItem(key,next){assert.equal(key,CALENDAR_TASKS_KEY);if(failWrite)throw Error('QuotaExceededError');value=next;writes++;},now:()=>stamp};return {storage,get raw(){return value;},get writes(){return writes;},external(next){value=next;},failRead(on){failRead=on;},failWrite(on){failWrite=on;}};}

test('Local create/edit/move/done/delete preserves stable IDs and only uses separate namespace',()=>{
 const m=memory(),store=createCalendarTaskStore(m.storage);assert.equal(store.dirty,false);assert.deepEqual(store.list(),[]);
 const first=store.set({date:'2026-11-01',text:'完成实验'});assert.match(first.id,/^task-/);assert.equal(store.dirty,true);assert.equal(m.writes,0);
 assert.equal(store.flush(),true);assert.equal(store.dirty,false);assert.equal(m.writes,1);
 const updated=store.set({id:first.id,date:'2026-11-02',text:'复查结果',done:true});assert.equal(updated.id,first.id);assert.equal(updated.done,true);assert.equal(store.list('2026-11-01').length,0);assert.equal(store.list('2026-11-02').length,1);
 assert.equal(store.flush(),true);assert.equal(createCalendarTaskStore(m.storage).get(first.id).text,'复查结果');
 assert.equal(store.remove('unknown'),false);assert.equal(store.remove(first.id),true);assert.equal(store.flush(),true);assert.deepEqual(store.list(),[]);
 assert.equal(CALENDAR_TASKS_KEY,'paper-signal-calendar-tasks-v1');
});

test('Plain text round trips safely as data; returned copies cannot silently mutate the store',()=>{
 const store=createCalendarTaskStore(memory().storage);const text='<script>alert(1)</script>\n"个人任务" & <img src=x>';
 const first=store.set({date:'2028-02-29',text});first.text='mutated';store.get(first.id).done=true;store.list()[0].date='2000-01-01';
 assert.equal(store.get(first.id).text,text);assert.equal(store.get(first.id).done,false);assert.equal(store.get(first.id).date,'2028-02-29');
 assert.equal(parseCalendarTasksImport(store.export()).get(first.id).text,text);
});

test('Validation bounds dates, IDs, types, contents, timestamps, total size and exact format',()=>{
 const valid=task();
 for(const patch of [{id:'__proto__'},{id:'constructor'},{id:''},{date:'2026-02-29'},{date:'2026-13-01'},{text:'  \n '},{text:'x'.repeat(MAX_TASK_LENGTH+1)},{done:'false'},{updatedAt:'yesterday'},{updatedAt:'2026-02-30T00:00:00.000Z'},{extra:'secret'}])assert.throws(()=>makeCalendarTasksExport([{...valid,...patch}]));
 assert.throws(()=>makeCalendarTasksExport([valid,valid]));
 assert.throws(()=>makeCalendarTasksExport(Array.from({length:MAX_CALENDAR_TASKS+1},(_,i)=>task('task-'+i))));
 assert.throws(()=>makeCalendarTasksExport(Array.from({length:MAX_CALENDAR_TASKS},(_,i)=>task('task-'+i,'2026-11-01','字'.repeat(MAX_TASK_LENGTH)))));
 assert.throws(()=>parseCalendarTasksImport('x'.repeat(MAX_CALENDAR_TASKS_BYTES+1)));
 assert.throws(()=>parseCalendarTasksImport('{bad'));
 for(const format of ['paper-signal-notes','paper-signal-bookmarks','conference-calendar'])assert.throws(()=>parseCalendarTasksImport(JSON.stringify({format,version:1,tasks:[valid]})));
 assert.throws(()=>parseCalendarTasksImport(JSON.stringify({format:'paper-signal-calendar-tasks',version:1,tasks:[valid],other:true})));
 assert.equal(parseCalendarTasksImport('\uFEFF'+makeCalendarTasksExport([valid])).size,1);
 const store=createCalendarTaskStore(memory().storage);assert.throws(()=>store.set({date:'2026-11-01',text:'valid',private:'bad'}));assert.equal(store.dirty,false);
});

test('Quota failure preserves create/edit/delete drafts without claiming saved; retry succeeds',()=>{
 const m=memory(),store=createCalendarTaskStore(m.storage);m.failWrite(true);
 const first=store.set({date:'2026-11-01',text:'unsaved'});assert.equal(store.flush(),false);assert.equal(store.dirty,true);assert.equal(store.get(first.id).text,'unsaved');assert.equal(m.raw,null);assert.match(store.error,/尚未保存/);assert.equal(parseCalendarTasksImport(store.export()).size,1);
 m.failWrite(false);assert.equal(store.flush(),true);const saved=m.raw;
 store.remove(first.id);m.failWrite(true);assert.equal(store.flush(),false);assert.equal(store.list().length,0);assert.equal(m.raw,saved);assert.equal(store.dirty,true);
 m.failWrite(false);assert.equal(store.flush(),true);assert.equal(parseCalendarTasksImport(m.raw).size,0);
});

test('Unreadable/corrupt existing storage never gets overwritten, even after new drafts',()=>{
 for(const raw of ['broken',JSON.stringify({format:'paper-signal-notes',version:1,notes:[]})]){
  const m=memory(raw),store=createCalendarTaskStore(m.storage);assert.equal(store.loadError,true);
  store.set({date:'2026-11-01',text:'draft'});assert.equal(store.flush(),false);assert.equal(m.raw,raw);assert.equal(m.writes,0);assert.equal(store.list().length,1);
  assert.throws(()=>store.import(makeCalendarTasksExport([task()])));assert.equal(store.reload(),false);
 }
 const m=memory();m.failRead(true);const store=createCalendarTaskStore(m.storage);assert.equal(store.loadError,true);m.failRead(false);assert.equal(store.reload(),true);assert.equal(store.loadError,false);
});

test('Cross-tab compare-before-write blocks stale overwrite and preserves exportable drafts',()=>{
 const m=memory(makeCalendarTasksExport([task()])),a=createCalendarTaskStore(m.storage),b=createCalendarTaskStore(m.storage);
 a.set({id:'task-one',date:'2026-11-01',text:'tab A'});assert.equal(a.flush(),true);const saved=m.raw;
 b.set({id:'task-one',date:'2026-11-01',text:'tab B'});assert.equal(b.flush(),false);assert.equal(b.conflict,true);assert.equal(m.raw,saved);assert.equal(b.get('task-one').text,'tab B');assert.match(b.error,/标签页/);assert.equal(b.reload(),false);
 assert.throws(()=>b.import(makeCalendarTasksExport([task('task-new')])));assert.equal(m.raw,saved);assert.equal(parseCalendarTasksImport(b.export()).get('task-one').text,'tab B');
 const clean=createCalendarTaskStore(m.storage);m.external(makeCalendarTasksExport([task('task-new')]));assert.equal(clean.reload(),true);assert.ok(clean.get('task-new'));assert.equal(clean.get('task-one'),undefined);
});

test('Import keeps existing versions, deduplicates identical content, retains unknown valid IDs',()=>{
 const a=task('task-a'),b=task('task-b'),changed={...a,text:'different'},same={...a,updatedAt:'2026-11-02T00:00:00.000Z'};
 let result=mergeCalendarTasks([a],[same,b]);assert.deepEqual([result.added,result.duplicates,result.conflicts],[1,1,0]);assert.equal(result.tasks.get('task-a').updatedAt,stamp);
 result=mergeCalendarTasks([a],[changed,b]);assert.deepEqual([result.added,result.duplicates,result.conflicts],[1,0,1]);assert.equal(result.tasks.get('task-a').text,a.text);
 const m=memory(makeCalendarTasksExport([a])),store=createCalendarTaskStore(m.storage);
 assert.deepEqual(store.import(makeCalendarTasksExport([changed,b])),{added:1,duplicates:0,conflicts:1});assert.equal(store.list().length,2);assert.equal(store.dirty,false);
 assert.deepEqual(store.import(makeCalendarTasksExport([a,b])),{added:0,duplicates:2,conflicts:0});
 const saved=m.raw;m.failWrite(true);assert.throws(()=>store.import(makeCalendarTasksExport([task('task-c')])));assert.equal(store.get('task-c'),undefined);assert.equal(m.raw,saved);
});

test('Validation errors are non-mutating and empty reads do not save spuriously',()=>{
 const m=memory(),store=createCalendarTaskStore(m.storage);assert.equal(store.flush(),true);assert.equal(m.writes,0);
 const first=store.set({date:'2026-11-01',text:'keep'});store.flush();const saved=m.raw;
 assert.throws(()=>store.set({id:first.id,date:'invalid',text:'changed'}));assert.equal(store.get(first.id).text,'keep');assert.equal(store.dirty,false);assert.equal(m.raw,saved);
 store.set({id:first.id,date:'2026-11-01',text:'keep'});assert.equal(store.dirty,false);
});
