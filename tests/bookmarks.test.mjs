import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBookmarkExport,parseBookmarkImport,mergeBookmarkImport,MAX_BOOKMARK_BYTES} from '../lib/bookmark-transfer.js';
import {countText} from '../lib/hud.js';

test('可移植书签导出/导入往返且去重，保留已有收藏',()=>{
  const payload=makeBookmarkExport(['paper-b','demo-one','paper-b'],new Date('2026-10-31T00:00:00Z'));
  assert.deepEqual(payload.ids,['demo-one','paper-b']);
  const imported=parseBookmarkImport(JSON.stringify(payload));
  const first=mergeBookmarkImport(new Set(['paper-a']),imported);
  assert.deepEqual([...first.ids],['paper-a','demo-one','paper-b']);
  assert.equal(first.added,2);
  const second=mergeBookmarkImport(first.ids,imported);
  assert.equal(second.added,0);assert.equal(second.duplicates,2);
});
test('导入拒绝损坏、超限、错误版本、URL、HTML和额外字段',()=>{
  const valid=makeBookmarkExport(['paper-a']);
  for(const value of ['broken','null','[]',JSON.stringify({...valid,version:2}),JSON.stringify({...valid,ids:['https://evil.test']}),JSON.stringify({...valid,ids:['<script>']}),JSON.stringify({...valid,url:'javascript:alert(1)'}),JSON.stringify({...valid,ids:[null]})])assert.throws(()=>parseBookmarkImport(value));
  assert.throws(()=>parseBookmarkImport(' '.repeat(MAX_BOOKMARK_BYTES+1)),/过大/);
  assert.throws(()=>parseBookmarkImport(JSON.stringify({...valid,ids:Array(5001).fill('paper-a')})),/过多/);
  assert.throws(()=>mergeBookmarkImport(new Set(Array.from({length:5000},(_,i)=>`paper-${i}`)),new Set(['new-paper'])),/超过/);
  assert.deepEqual([...parseBookmarkImport('\uFEFF'+JSON.stringify(valid))],['paper-a']);
});
test('HUD 数字来源明确，不生成随机活动',()=>{
  assert.equal(countText(0),'000');assert.equal(countText(4),'004');assert.equal(countText(12345),'12345');
});
