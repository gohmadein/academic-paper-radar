import test from 'node:test';
import assert from 'node:assert/strict';
import {NOTES_KEY,MAX_NOTE_LENGTH,MAX_NOTES,MAX_NOTES_BYTES,makeNotesExport,parseNotesImport,mergeNotes,createNotesStore} from '../lib/paper-notes.js';
import {makeBookmarkExport,parseBookmarkImport} from '../lib/bookmark-transfer.js';
const payload=notes=>JSON.stringify({format:'paper-signal-notes',version:1,notes});
function storage(initial=null) {
  const values=new Map(initial===null?[]:[[NOTES_KEY,initial]]);
  return {values,fail:false,getItem:key=>values.get(key)??null,setItem(key,value){if(this.fail)throw Error('QuotaExceededError');values.set(key,value);}};
}
test('Notes roundtrip plain multiline Unicode and HTML-looking text without interpreting it',()=>{
  const text='中文想法\n</textarea><script>alert(1)</script> & "\n📝';
  const original=new Map([['arxiv-2610-12345',text],['unknown-paper',' private ']]);
  const encoded=makeNotesExport(original);
  assert.deepEqual(parseNotesImport(encoded),original);
  assert.deepEqual(parseNotesImport('\uFEFF'+encoded),original);
  assert.deepEqual(Object.keys(JSON.parse(encoded)),['format','version','notes']);
});
test('Stable paper ID storage survives reload; clearing a note is explicit and only changes that ID',()=>{
  const disk=storage(),store=createNotesStore(disk);
  store.set('paper-one','first');store.set('paper-two','second');assert.equal(store.dirty,true);
  assert.equal(store.flush(),true);assert.equal(store.dirty,false);
  const reloaded=createNotesStore(disk);assert.equal(reloaded.get('paper-one'),'first');
  reloaded.set('paper-one','');assert.equal(reloaded.has('paper-one'),false);assert.equal(reloaded.get('paper-two'),'second');
  assert.equal(reloaded.flush(),true);assert.equal(createNotesStore(disk).get('paper-two'),'second');
});
test('Length, total bytes, entry count, duplicate and unsafe IDs are bounded',()=>{
  const store=createNotesStore(storage());store.set('paper-one','a'.repeat(MAX_NOTE_LENGTH));assert.equal(store.flush(),true);
  assert.throws(()=>store.set('paper-one','a'.repeat(MAX_NOTE_LENGTH+1)));assert.equal(store.get('paper-one').length,MAX_NOTE_LENGTH);
  for(const id of ['__proto__','constructor','prototype','<img>','https://evil.test','',null,'A','x'.repeat(101)])assert.throws(()=>parseNotesImport(payload([{id,text:'x'}])));
  assert.throws(()=>parseNotesImport(payload([{id:'a',text:'x'},{id:'a',text:'y'}])));
  assert.throws(()=>parseNotesImport(payload([{id:'a',text:''}])));
  assert.throws(()=>parseNotesImport(payload([{id:'a',text:'x',html:'unsafe'}])));
  assert.throws(()=>parseNotesImport(payload(Array.from({length:MAX_NOTES+1},(_,i)=>({id:'p-'+i,text:'x'})))));
  assert.throws(()=>parseNotesImport(' '.repeat(MAX_NOTES_BYTES+1)));
  assert.throws(()=>makeNotesExport(new Map(Array.from({length:100},(_,i)=>['p-'+i,'汉'.repeat(MAX_NOTE_LENGTH)]))));
  assert.equal({}.polluted,undefined);
});
test('Malformed storage remains untouched and unsaved drafts remain exportable',()=>{
  const disk=storage('{bad json'),store=createNotesStore(disk);
  assert.equal(store.loadError,true);store.set('paper-one','rescue me');assert.equal(store.flush(),false);
  assert.equal(store.dirty,true);assert.equal(disk.values.get(NOTES_KEY),'{bad json');
  assert.equal(parseNotesImport(store.export()).get('paper-one'),'rescue me');
  assert.throws(()=>store.import(payload([{id:'paper-two',text:'x'}])));
});
test('Blocked reads and quota failure never report drafts saved; quota retry can recover',()=>{
  const blocked=createNotesStore({getItem(){throw Error('SecurityError')},setItem(){throw Error('SecurityError')}});
  blocked.set('paper-one','local draft');assert.equal(blocked.flush(),false);assert.equal(blocked.get('paper-one'),'local draft');assert.equal(blocked.dirty,true);
  const disk=storage(),store=createNotesStore(disk);disk.fail=true;
  store.set('paper-one','draft one');assert.equal(store.flush(),false);store.set('paper-two','draft two');assert.equal(store.flush(),false);
  assert.equal(disk.values.has(NOTES_KEY),false);assert.equal(store.get('paper-one'),'draft one');
  disk.fail=false;assert.equal(store.flush(),true);assert.equal(store.dirty,false);assert.equal(createNotesStore(disk).get('paper-two'),'draft two');
});
test('Merge adds unknown IDs, skips conflicting notes and counts duplicates without changing either input',()=>{
  const existing=new Map([['a','keep'],['b','same']]),incoming=new Map([['a','replace'],['b','same'],['unknown-paper','new']]);
  const result=mergeNotes(existing,incoming);
  assert.equal(result.added,1);assert.equal(result.conflicts,1);assert.equal(result.duplicates,1);
  assert.equal(result.notes.get('a'),'keep');assert.equal(result.notes.get('unknown-paper'),'new');assert.equal(existing.size,2);assert.equal(incoming.get('a'),'replace');
  const disk=storage(makeNotesExport(existing)),store=createNotesStore(disk);
  assert.equal(store.import(makeNotesExport(incoming)).conflicts,1);assert.equal(createNotesStore(disk).get('a'),'keep');
});
test('Failed import is transactional and does not discard an unsaved draft',()=>{
  const disk=storage(),store=createNotesStore(disk);store.set('a','draft');disk.fail=true;
  assert.throws(()=>store.import(payload([{id:'b',text:'incoming'}])));
  assert.equal(store.get('a'),'draft');assert.equal(store.get('b'),'');assert.equal(store.dirty,true);
  for(const value of ['null','[]','{}','{',payload([{id:'a',text:1}])])assert.throws(()=>store.import(value));
  assert.equal(store.get('a'),'draft');
});
test('Old bookmark format remains valid in its own importer and is safely rejected by notes importer',()=>{
  const old=JSON.stringify(makeBookmarkExport(new Set(['paper-one'])));
  assert.deepEqual([...parseBookmarkImport(old)],['paper-one']);
  const store=createNotesStore(storage());store.set('paper-one','untouched');
  assert.throws(()=>store.import(old),/书签/);assert.equal(store.get('paper-one'),'untouched');
  assert.throws(()=>parseBookmarkImport(store.export()));
});

test('Stale tabs cannot overwrite newer saved notes and keep their own draft exportable',()=>{
  const disk=storage(),first=createNotesStore(disk),stale=createNotesStore(disk);
  first.set('paper-one','newer saved');assert.equal(first.flush(),true);
  stale.set('paper-two','stale tab draft');assert.equal(stale.flush(),false);assert.equal(stale.conflict,true);assert.equal(stale.dirty,true);
  assert.equal(createNotesStore(disk).get('paper-one'),'newer saved');assert.equal(createNotesStore(disk).get('paper-two'),'');
  assert.equal(parseNotesImport(stale.export()).get('paper-two'),'stale tab draft');
  assert.throws(()=>stale.import(payload([{id:'paper-three',text:'incoming'}])));
  assert.equal(createNotesStore(disk).get('paper-one'),'newer saved');
});

test('Aggregate limit never discards drafts; one-paper backup remains available for recovery',()=>{
  const disk=storage(),store=createNotesStore(disk);
  for(let i=0;i<100;i++)store.set('paper-'+i,'汉'.repeat(MAX_NOTE_LENGTH));
  assert.equal(store.flush(),false);assert.equal(store.dirty,true);assert.throws(()=>store.export());
  const current=parseNotesImport(store.export('paper-50'));
  assert.equal(current.size,1);assert.equal(current.get('paper-50'),'汉'.repeat(MAX_NOTE_LENGTH));
  assert.equal(store.get('paper-99').length,MAX_NOTE_LENGTH);assert.equal(disk.values.has(NOTES_KEY),false);
});
