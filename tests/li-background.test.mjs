import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {liBackgroundSlot,liBackgroundClass} from '../lib/li-background.js';
const days=(...dates)=>dates.map(date=>({date}));
test('Anchor starts with first photo, advances per published issue including missed days',()=>{
 const initial=days('2026-11-01','2026-10-31');
 assert.equal(liBackgroundSlot(initial),0);
 assert.equal(liBackgroundSlot([...initial,...days('2026-11-04')]),1);
 assert.equal(liBackgroundSlot([...initial,...days('2026-11-04','2026-11-09')]),0);
});
test('Retries, sorting, older backfills and same-day replacements do not rotate',()=>{
 const current=days('2026-11-04','2026-11-01');
 assert.equal(liBackgroundSlot(current),1);
 assert.equal(liBackgroundSlot([...current,...days('2026-11-04','2026-10-28')].reverse()),1);
 assert.equal(liBackgroundSlot(current),liBackgroundSlot(current));
});
test('Only real Li feed uses photos; date/search/read filters do not change current photograph',()=>{
 const current=days('2026-11-04','2026-11-01');
 const state={view:'feed',category:'li',demo:false};
 assert.equal(liBackgroundClass(state,current),'li-background-1');
 for(const patch of [{date:'2026-10-31'},{date:'all'},{q:'repair'},{readStatus:'read'}])assert.equal(liBackgroundClass({...state,...patch},current),'li-background-1');
 for(const patch of [{view:'sources'},{view:'archive'},{view:'bookmarks'},{demo:true},{category:'xun'},{category:'lv'},{category:'all'}])assert.equal(liBackgroundClass({...state,...patch},current),'');
 assert.equal(liBackgroundClass(state,[]),'');
});
test('Glass has no animation, safe fallback and independently packaged local photographs',async()=>{
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
 const block=css.slice(css.indexOf('/* Li-only'));
 assert.match(block,/@supports/);assert.match(block,/prefers-reduced-transparency/);assert.match(block,/@media print/);
 assert.match(block,/\.feed-glass \.paper-card,\.feed-glass \.institution-library\{background:#fff/);
 assert.doesNotMatch(block,/animation\s*:|transition\s*:|https?:/);
 const assets=[...block.matchAll(/url\("\.\/(assets\/decor\/li-photo-[^"]+)"\)/g)].map(m=>m[1]);
 assert.equal(assets.length,2);
 const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 for(const path of assets){assert.ok(build.includes(path));assert.ok((await readFile(new URL('../'+path,import.meta.url))).length>10000);}
});
test('White veil and glass minimum luminance keep reading text above 4.5:1',()=>{
 const luminance=rgb=>rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
 const veil=184/255,glass=133/255;
 const contrast=(fg,bg)=>(luminance(bg)+.05)/(luminance(fg)+.05);
 const darkestVeil=255*veil, darkestCard=255*(veil+glass*(1-veil));
 assert.ok(contrast([53,67,88],[darkestVeil,darkestVeil,darkestVeil])>=4.5);
 assert.ok(contrast([82,98,122],[darkestCard,darkestCard,darkestCard])>=4.5);
});
test('Institution library outer container is rounded; shared glass keeps logo surfaces untouched',async()=>{
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
 const containers=[...css.matchAll(/\.institution-library\{([^}]+)\}/g)].map(m=>m[1]);
 assert.ok(containers.some(rule=>rule.includes('border-radius:16px')));
 assert.ok(!containers.some(rule=>rule.includes('border-radius:0')));
 const shared=css.slice(css.indexOf('/* Li-only'));
 assert.match(shared,/\.feed-glass \.paper-card,\.feed-glass \.institution-library/);
 assert.doesNotMatch(shared,/\.institution-library-(?:mark|card)\b/);
 assert.match(css,/\.xun-side-art main\{[^}]*background:#fff/);
 assert.match(shared,/\.li-background-0::before/);
});
