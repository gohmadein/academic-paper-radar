import test from 'node:test';import assert from 'node:assert/strict';import{readFile,mkdtemp,mkdir,writeFile}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{createHash}from'node:crypto';
import{editorialCard,bilingualDetail}from'../lib/digest-view.js';import{validateVisuals,assetURL,handleMediaError}from'../lib/paper-media.js';import{publicPaperURL,sharePaper}from'../lib/paper-share.js';import{readAsset,imageDimensions}from'../scripts/media-assets.mjs';
const day=JSON.parse(await readFile(new URL('../data/days/2026-10-31.json',import.meta.url),'utf8'));
const first={...day.papers[0],date:day.date};
const asset={kind:'figure',path:'assets/papers/fixture.png',sha256:'a'.repeat(64),width:1,height:1,sourceUrl:'https://example.org/official/figure',evidenceUrl:'https://example.org/paper',verifiedAt:'2026-10-31',credit:'Test fixture, not a scientific figure',rights:'Test-only fixture',displayPolicy:'attributed-thumbnail',background:'light',altZh:'测试图，非科研素材',altEn:'Test fixture, not research content'};

test('11篇中英导读同时可见，英文标为中文导读翻译，日期区分发表与收录',()=>{
 for(const p of day.papers){assert.ok(p.summaryEn.length>40);const html=editorialCard({...p,date:day.date},0);assert.ok(html.indexOf(p.summary)<html.indexOf(p.summaryEn));assert.ok(html.includes('TRANSLATION'));assert.ok(html.includes(p.titleEn.replaceAll('&','&amp;')));assert.ok(html.includes('发表')&&html.includes('收录'));assert.ok(!html.includes('data-like')&&!html.includes('view-count'));}
 assert.ok(bilingualDetail(first).includes('translation of the Chinese guide'));
});
test('无主图/肖像时诚实占位，机构品牌不能被用作个人肖像',()=>{
 const p=structuredClone(first);p.visuals={mainFigure:null,figureNote:'理论论文没有可核实主图。',institutions:[{name:'Restricted Institute',logo:null,authorNames:[],evidence:[{url:'https://example.org/paper',claim:'Paper lists the affiliation',checkedAt:'2026-10-31'}],note:'文字展示，未取得标志使用许可。'}],authors:[]};
 assert.deepEqual(validateVisuals(p),[]);const html=editorialCard(p,0);assert.ok(html.includes('暂无可核实主图'));assert.ok(html.includes('文字标识'));assert.ok(html.includes('无已核实肖像'));assert.ok(!html.includes('<img'));
 p.visuals.authors=[{name:p.authors[0],portrait:{...asset,kind:'institution-logo',displayPolicy:'official-brand'},note:'invalid'}];assert.ok(validateVisuals(p).length);
 assert.equal(assetURL({...asset,path:'../secret.png'}),null);assert.equal(assetURL({...asset,path:'https://external.example/a.png'}),null);
});
test('媒体加载失败启用保留尺寸的占位，不留下损坏图标',()=>{
 assert.ok(editorialCard(first,0).includes('已核验主图暂不可用，可查看原始来源。'));
 const fallback={hidden:true},link={hidden:false};const frame={querySelector:()=>fallback};const image={hidden:false,closest:s=>s==='.figure-frame'?frame:link};handleMediaError(image);assert.equal(image.hidden,true);assert.equal(link.hidden,true);assert.equal(fallback.hidden,false);
 const initial={hidden:true};const avatarImage={hidden:false,closest:s=>s==='.media-avatar'?{querySelector:()=>initial}:null};handleMediaError(avatarImage);assert.equal(initial.hidden,false);
});
test('分享只包含公开论文定位，支持系统分享/复制/取消/手动备用',async()=>{
 const url=publicPaperURL('https://example.org/academic-paper-radar/?private=1#view=bookmarks&read=read&q=private',first);
 assert.ok(!url.includes('private')&&!url.includes('bookmarks')&&!url.includes('read=read'));assert.ok(url.includes(first.id)&&url.includes(day.date));
 assert.equal(await sharePaper({url,title:first.title},{share:async data=>assert.equal(data.url,url)}),'shared');
 let copied='';assert.equal(await sharePaper({url},{share:async()=>{throw Error('unsupported');},copy:async text=>{copied=text;}}),'copied');assert.equal(copied,url);
 assert.equal(await sharePaper({url},{share:async()=>{const e=Error();e.name='AbortError';throw e;},copy:async()=>assert.fail('cancel should not copy')}),'cancelled');
 assert.equal(await sharePaper({url},{copy:async()=>{throw Error('denied');}}),'manual');
});
test('图像字节、SHA及尺寸必须匹配，SVG禁止脚本与外部依赖',async()=>{
 const base=await mkdtemp(join(tmpdir(),'zero-field-media-'));await mkdir(join(base,'assets/papers'),{recursive:true});
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrsoAAAAASUVORK5CYII=','base64');await writeFile(join(base,asset.path),bytes);
 const real={...asset,sha256:createHash('sha256').update(bytes).digest('hex')};assert.deepEqual(imageDimensions(bytes,'.png'),{width:1,height:1});await readAsset(real,base);
 await assert.rejects(readAsset({...real,width:2},base),/尺寸/);await assert.rejects(readAsset({...real,sha256:'0'.repeat(64)},base),/SHA/);
 assert.throws(()=>imageDimensions(Buffer.from('<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>'),'.svg'));
 assert.throws(()=>imageDimensions(Buffer.from('<svg viewBox="0 0 10 10"><image href="https://external.example/a.png"/></svg>'),'.svg'));
});
