import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBookmarkExport,parseBookmarkImport,mergeBookmarkImport,MAX_BOOKMARK_BYTES} from '../lib/bookmark-transfer.js';
import {countText} from '../lib/hud.js';
import {createSupabaseBookmarkAdapter} from '../lib/bookmark-sync.js';

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
test('后端适配器拒绝特权密钥、非HTTPS项目和未登录写入',async()=>{
  for(const key of ['sb_secret_test','not-a-key',`e30.${btoa(JSON.stringify({role:'service_role'}))}.x`])assert.throws(()=>createSupabaseBookmarkAdapter({url:'https://example.supabase.co',publishableKey:key}));
  assert.throws(()=>createSupabaseBookmarkAdapter({url:'http://example.supabase.co',publishableKey:'sb_publishable_test'}));
  const adapter=createSupabaseBookmarkAdapter({url:'https://example.supabase.co',publishableKey:'sb_publishable_test',fetchImpl:()=>{throw new Error('网络不应触发');}});
  await assert.rejects(adapter.add('paper-one'),/登录/);
});
test('后端401/403失败不报告同步成功，成功写入必须读回确认',async()=>{
  for(const status of [401,403]){
    const adapter=createSupabaseBookmarkAdapter({url:'https://example.supabase.co',publishableKey:'sb_publishable_test',getAccessToken:()=> 'test-user-jwt',fetchImpl:async()=>new Response('',{status})});
    await assert.rejects(adapter.add('paper-one'),/权限不足/);
  }
  const records=new Set();const methods=[];
  const adapter=createSupabaseBookmarkAdapter({url:'https://example.supabase.co',publishableKey:'sb_publishable_test',getAccessToken:()=> 'test-owner-jwt',fetchImpl:async(url,options)=>{
    methods.push(options.method);
    if(options.method==='POST'){records.add(JSON.parse(options.body).paper_id);return new Response(null,{status:204});}
    if(options.method==='DELETE'){records.clear();return new Response(null,{status:204});}
    return new Response(JSON.stringify([...records].map(paper_id=>({paper_id}))),{status:200});
  }});
  assert.ok((await adapter.add('paper-one')).has('paper-one'));
  assert.equal((await adapter.remove('paper-one')).size,0);
  assert.deepEqual(methods,['POST','GET','DELETE','GET']);
  const silentDeny=createSupabaseBookmarkAdapter({url:'https://example.supabase.co',publishableKey:'sb_publishable_test',getAccessToken:()=> 'test-not-owner',fetchImpl:async(_,o)=>o.method==='GET'?new Response('[]',{status:200}):new Response(null,{status:204})});
  await assert.rejects(silentDeny.add('paper-one'),/不能标记已同步/);
});
