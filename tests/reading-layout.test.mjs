import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {editorialCard} from '../lib/digest-view.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('Reading cards keep bilingual content, verified identity, sources and labelled round actions',async()=>{
 const day=JSON.parse(await read('data/days/2026-10-31.json'));
 for(const paper of day.papers){
  const p={...paper,date:day.date},card=editorialCard(p,0),expanded=editorialCard(p,0,{expanded:true,saved:true});
  assert.match(card,/class="paper-people"/);
  assert.match(card,/aria-controls="guide-[^"]+" aria-expanded="false"/);
  assert.match(expanded,/class="bilingual-guide is-expanded"/);
  assert.match(expanded,/aria-expanded="true"/);
  assert.match(card,/class="share-button"[^>]*aria-label="分享论文/);
  assert.match(card,/class="bookmark-button [^"]*"[^>]*aria-label=/);
  assert.ok(card.indexOf('lang="zh-CN"')<card.indexOf('class="guide-language english-guide"'));
  assert.match(card,/方向推荐与阅读建议/);assert.match(card,/source-note/);
  assert.doesNotMatch(card,/data-like|view-count|研究者关注/);
 }
});

test('Reading layout bounds desktop width and provides mobile stacking without hiding either guide',async()=>{
 const css=await read('styles.css');
 assert.match(css,/main\{max-width:1120px;padding:0 32px\}/);
 assert.match(css,/\.rail-collapsed main\{max-width:1160px\}/);
 assert.match(css,/\.editorial-grid\{grid-template-columns:minmax\(0,2.05fr\) minmax\(0,1fr\)/);
 assert.match(css,/\.bilingual-guide:not\(\.is-expanded\) \.guide-language>p\{[^}]*-webkit-line-clamp:2/);
 assert.match(css,/@media\(max-width:560px\)[\s\S]*\.editorial-grid\{grid-template-columns:minmax\(0,1fr\)/);
 assert.doesNotMatch(css,/\.english-guide[^}]*display:none/);
});
