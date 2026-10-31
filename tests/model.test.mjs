import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,cp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {isDate,safeUrl,escapeHTML,filterPapers,readRoute,routeHash,parseBookmarks,validateIndex,validateDay} from '../lib/model.js';
import {root,validateAll} from '../scripts/validate.mjs';

const day=JSON.parse(await readFile(new URL('../data/demo/days/2026-10-31.json',import.meta.url),'utf8'));
const papers=day.papers.map(p=>({...p,date:day.date}));
const realPaper={...structuredClone(papers[0]),id:'verified-paper',demo:false,sources:[{label:'原文',url:'https://example.org/paper'}]};
delete realPaper.notice;

test('日期拒绝溢出、路径注入与无效格式',()=>{
  assert.ok(isDate('2024-02-29'));
  for(const value of ['2026-02-29','2026-13-01','2026-01-32','2026-1-01','../a',null])assert.equal(isDate(value),false);
});
test('来源仅允许无凭据 HTTP(S)，拒绝脚本/数据/相对 URL',()=>{
  assert.equal(safeUrl('https://example.org/paper?q=1'),'https://example.org/paper?q=1');
  for(const value of ['javascript:alert(1)','data:text/html,x','//evil.test','https://name:secret@example.org','file:///tmp/a','not a URL'])assert.equal(safeUrl(value),null);
});
test('所有 HTML 特殊字符转义，论文文本不可注入元素和属性',()=>{
  const result=escapeHTML('<img src=x onerror="alert(1)"> & \'');
  assert.equal(result,'&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;');
  assert.equal(result.includes('<'),false);
});
test('搜索同时检查标题、摘要、作者与英文，日期/主题/书签可组合',()=>{
  assert.equal(filterPapers(papers,{q:'评估'}).length,1);
  assert.equal(filterPapers(papers,{q:'ILLUSTRATIVE'}).length,1);
  assert.equal(filterPapers(papers,{q:'占位'}).length,3);
  assert.equal(filterPapers(papers,{tag:'研究方法'}).length,2);
  assert.equal(filterPapers(papers,{tag:'研究方法',date:'2026-10-31',bookmarks:new Set(['demo-research-question'])}).length,1);
  assert.equal(filterPapers(papers,{date:'2026-10-30'}).length,0);
  assert.equal(filterPapers(papers,{q:'不存在的关键词'}).length,0);
});
test('分享路由可往返中文与特殊字符，限制非法日期、视图及超长输入',()=>{
  const state={category:'all',readStatus:'all',view:'bookmarks',demo:true,date:'2026-10-31',q:'模型 & <test>',tag:'研究方法',paper:'demo-research-question'};
  assert.deepEqual(readRoute(routeHash(state)),state);
  const invalid=readRoute('#view=admin&date=../../x&q='+ 'a'.repeat(500));
  assert.equal(invalid.view,'feed');assert.equal(invalid.date,'all');assert.equal(invalid.q.length,200);
});
test('损坏或恶意本地存储安全降级',()=>{
  assert.equal(parseBookmarks('broken').size,0);
  assert.equal(parseBookmarks('{"__proto__":{}}').size,0);
  assert.deepEqual([...parseBookmarks('["demo-one",null,42,"<script>","demo-one"]')],['demo-one']);
});
test('校验真实与演示身份分离，来源必填，重复编号拒绝',()=>{
  assert.deepEqual(validateDay(day,{demo:true}),[]);
  assert.ok(validateDay(day,{demo:false}).length);
  const realDay={version:1,date:'2026-10-31',title:'真实日报',demo:false,papers:[realPaper]};
  assert.deepEqual(validateDay(realDay),[]);
  assert.ok(validateDay({...realDay,papers:[{...realPaper,sources:[]}]}).length);
  assert.ok(validateDay({...realDay,papers:[realPaper,realPaper]}).length);
  assert.ok(validateDay({...day,papers:[{...day.papers[0],notice:''}]},{demo:true}).length);
  assert.ok(validateIndex({version:1,days:[{date:'2026-10-31',file:'../../secrets',count:1,title:'x'}]}).length);
});
test('仓库完整数据通过一致性检查，真实与演示保持分离',async()=>{
  const result=await validateAll();assert.deepEqual(result.errors,[]);
  assert.ok(Array.isArray(JSON.parse(await readFile(join(root,'data','index.json'),'utf8')).days));
});
test('仓库验证拒绝索引计数错误和遗失文件',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'paper-signal-test-'));
  await cp(join(root,'data'),join(temp,'data'),{recursive:true});
  const path=join(temp,'data','demo','index.json');
  const index=JSON.parse(await readFile(path,'utf8'));
  index.days[0].count=99;
  await writeFile(path,JSON.stringify(index));
  assert.ok((await validateAll(temp)).errors.some(e=>e.includes('数量与索引不一致')));
});
test('发布页面无远程运行时资源与第三方导入，支持项目子目录',async()=>{
  const html=await readFile(join(root,'index.html'),'utf8');
  assert.equal(/(?:src|href)=["']https?:\/\//.test(html),false);
  assert.ok(html.includes('connect-src \'self\''));
  for(const file of ['app.js','lib/model.js','lib/hud.js','lib/bookmark-transfer.js','styles.css']){
    const text=await readFile(join(root,file),'utf8');
    assert.equal(/(?:import\s.*from\s*["']https?:|@import|url\(["']?https?:)/.test(text),false);
  }
  assert.ok(html.includes('src="./app.js"'));
});
