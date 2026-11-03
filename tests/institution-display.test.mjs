import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {markDimensions,institutionDisplayCSS,validateInstitutionDisplay,institutionMarkClass} from '../lib/institution-display.js';
const registry=JSON.parse(await readFile(new URL('../data/institutions.json',import.meta.url)));
test('all verified marks receive external CSP-safe geometry without stretching originals',()=>{
 const css=institutionDisplayCSS(registry);for(const i of registry.institutions.filter(i=>i.logo)){assert.ok(css.includes('.institution-avatar.'+institutionMarkClass(i.logo)));const d=markDimensions(i.logo);assert.ok(d.outerWidth<=128);assert.ok(d.outerHeight<=33);}
 assert.ok(!css.includes('filter:'));assert.deepEqual(validateInstitutionDisplay(registry),[]);
});
test('large native canvas preserves visible emblem minimum and gallery size, not a fixed32px box',()=>{
 const asset={path:'assets/institutions/test.png',width:413,height:297,sha256:'a'.repeat(64)};const r={institutions:[{logo:asset}]};const c={version:1,marks:{[asset.path]:{imageWidthPx:72,imageHeightPx:52,paddingPx:3,background:'transparent',visibleBounds:[94,32,224,224],minVisibleWidthPx:38,minVisibleHeightPx:38,evidenceUrl:'https://example.edu/identity',note:'Test reviewed native canvas'}}};
 assert.deepEqual(validateInstitutionDisplay(r,c),[]);assert.match(institutionDisplayCSS(r,c),/width:78px;height:58px/);assert.match(institutionDisplayCSS(r,c),/institution-library-mark/);
 c.marks[asset.path].imageWidthPx=32;c.marks[asset.path].imageHeightPx=23;assert.ok(validateInstitutionDisplay(r,c).some(x=>x.includes('最小尺寸')));
});
test('oversize marks have own-row scrolling and no injected style syntax',async()=>{
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');assert.match(css,/institution-item\.institution-item-large\{[^}]*overflow-x:auto/);
 const c={version:1,marks:{[registry.institutions.find(x=>x.logo).logo.path]:{imageWidthPx:40,imageHeightPx:40,paddingPx:2,background:'red;}body{display:none',evidenceUrl:'https://example.edu',note:'bad'}}};assert.ok(validateInstitutionDisplay(registry,c).length);
});
test('official linked-mark condition survives card and gallery rendering without private state',async()=>{
 const {institutionDisplayRules}=await import('../lib/institution-display-rules.js');const {institutionRow}=await import('../lib/paper-media.js');const {institutionGallery}=await import('../lib/institutions.js');
 const i=registry.institutions.find(x=>x.logo&&!x.displayScope),path=i.logo.path,previous=institutionDisplayRules.marks[path];
 institutionDisplayRules.marks[path]={imageWidthPx:32,imageHeightPx:32,paddingPx:0,background:'white',linkUrl:'https://example.edu/',evidenceUrl:'https://example.edu/identity',note:'Official linking-only test fixture'};
 try{const p={visuals:{institutions:[{...i,name:i.officialName,institutionId:i.id}]}};for(const html of [institutionRow(p),institutionGallery([p],registry)]){assert.match(html,/<a href="https:\/\/example.edu\/" target="_blank" rel="noopener noreferrer"/);assert.ok(!html.includes('style='));}}finally{if(previous)institutionDisplayRules.marks[path]=previous;else delete institutionDisplayRules.marks[path];}
});
test('visible glyph and clearspace constraints use object-fit scale, not transparent canvas dimensions',()=>{
 const a={path:'assets/institutions/large.png',width:960,height:960,sha256:'b'.repeat(64)},r={institutions:[{logo:a}]};
 const c={version:1,marks:{[a.path]:{imageWidthPx:108,imageHeightPx:108,paddingPx:84,background:'white',visibleBounds:[74,72,816,818],minVisibleWidthPx:91,minVisibleHeightPx:91,minClearSpacePx:91,evidenceUrl:'https://example.edu/brand',note:'Conservative spacing fixture'}}};
 assert.deepEqual(validateInstitutionDisplay(r,c),[]);assert.match(institutionDisplayCSS(r,c),/width:276px;height:276px/);c.marks[a.path].paddingPx=0;assert.ok(validateInstitutionDisplay(r,c).some(x=>x.includes('安全留白')));
});
test('own-row wide and tall marks retain explicit height under column flex layout',()=>{
 for(const [width,height] of [[300,60],[100,250]]){
  const a={path:'assets/institutions/shape.png',width,height,sha256:'c'.repeat(64)},r={institutions:[{logo:a}]},c={version:1,marks:{[a.path]:{imageWidthPx:width,imageHeightPx:height,paddingPx:5,background:'white',evidenceUrl:'https://example.edu/brand',note:'Non-square geometry fixture'}}};
  const css=institutionDisplayCSS(r,c);assert.match(css,/flex:0 0 auto/);assert.ok(css.includes(`width:${width+10}px;height:${height+10}px`));assert.ok(!css.includes(`flex:0 0 ${width+10}px`));
 }
});

test('compact mode unifies cards, details and gallery at40x32 without shrinking full wordmarks',async()=>{
 const {institutionMarkVisible,institutionMarkNeedsOwnRow}=await import('../lib/institution-display.js');const {institutionRow}=await import('../lib/paper-media.js');const {institutionGallery}=await import('../lib/institutions.js');const css=institutionDisplayCSS(registry);
 for(const i of registry.institutions.filter(x=>x.logo)){assert.equal(institutionMarkNeedsOwnRow(i.logo),false);assert.ok(css.includes(`.institution-avatar.${institutionMarkClass(i.logo)},.institution-library-mark.${institutionMarkClass(i.logo)}{width:40px;height:32px;flex:0 0 auto;padding:0`));}
 const known=registry.institutions.find(x=>x.logo&&x.markType==='emblem'&&!x.displayScope),wide={...known,officialName:'Example institution',markType:'wordmark',logo:{...known.logo,width:1000,height:100,path:'assets/institutions/new-wordmark.png'}};
 const p={visuals:{institutions:[{...wide,name:wide.officialName}]}};assert.equal(institutionMarkVisible(wide.logo,wide.markType),false);assert.doesNotMatch(institutionRow(p),/<img/);assert.match(institutionRow(p),/Example institution/);assert.doesNotMatch(institutionGallery([p],{institutions:[wide]}),/<img/);
 assert.equal(institutionMarkVisible(known.logo,known.markType),true);assert.ok(!institutionRow({visuals:{institutions:[{...known,name:known.officialName}]}}).includes('institution-item-large'));
});

test('November3 daily additions retain compact symbols and honest name-only fallback',async()=>{
 const {institutionMarkVisible}=await import('../lib/institution-display.js');
 const {institutionRow}=await import('../lib/paper-media.js');
 const day=JSON.parse(await readFile(new URL('../data/days/2026-11-03.json',import.meta.url)));
 assert.equal(day.papers.length,5);
 for(const id of ['pending-university-of-bordeaux','pending-holiday-robotics','pending-hessianai']){
  const i=registry.institutions.find(x=>x.id===id);assert.ok(i);assert.ok(institutionMarkVisible(i.logo,i.markType));assert.equal(i.displayScope,'paper-affiliation-only');
  assert.ok(institutionRow({visuals:{institutions:[{...i,name:i.officialName,institutionId:id}]}}).includes('<img'));
 }
 for(const id of ['pending-bordeaux-inp','pending-labri-umr-5800']){const i=registry.institutions.find(x=>x.id===id);assert.ok(i);assert.equal(i.logo,null);}
});
