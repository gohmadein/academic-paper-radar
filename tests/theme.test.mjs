import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setStaticValue} from '../lib/hud.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const luminance=hex=>{
  const rgb=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};

test('Light theme text and focus palette meets readable contrast',async()=>{
  const css=await read('styles.css');
  for(const hex of ['#f6f8fc','#18263f','#52627a','#175cd3','#d92d20'])assert.ok(css.includes(hex));
  for(const [fg,bg] of [['175cd3','ffffff'],['d92d20','ffffff'],['52627a','f6f8fc'],['18263f','ffffff'],['b42318','fff1ef']])assert.ok(contrast(fg,bg)>=4.5,`${fg} / ${bg}`);
  assert.match(css,/focus-visible[^}]*outline:3px solid var\(--blue\)/);
});

test('No animation or image filters; only explicitly scoped feed backdrop glass is allowed',async()=>{
  const html=await read('index.html'),css=await read('styles.css');
  assert.doesNotMatch(html,/<filter\b|scanlines|line-toggle|rgb-toggle|glitch-title|flip-counter/);
  assert.doesNotMatch(css,/@keyframes|\banimation\s*:|(?:^|[;{])\s*filter\s*:|text-shadow|repeating-linear-gradient/);
  assert.doesNotMatch(css.split('/* Li-only')[0],/backdrop-filter/);
  for(const p of ['app.js','lib/hud.js'])assert.doesNotMatch(await read(p),/requestAnimationFrame|setInterval|createHeroLineEffect|digit-top|digit-bottom/);
});

test('Archive counters render one static, accessible value without digit layers',()=>{
  const labels={};
  const element={textContent:'',setAttribute:(name,value)=>labels[name]=value};
  setStaticValue(element,'004','演示条目 4 篇');
  assert.equal(element.textContent,'004');assert.equal(labels['aria-label'],'演示条目 4 篇');
  setStaticValue(element,'000','真实论文 0 篇');assert.equal(element.textContent,'000');
});
