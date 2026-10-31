import test from 'node:test';
import assert from 'node:assert/strict';
import {lineBlockAt,buildLineMap} from '../lib/line-block.js';

test('Horizontal band map preserves source quantized grids and both directions',()=>{
  const all=[];
  for(const time of [1,3,8,15,24,50]){
    const {bands}=buildLineMap(time);
    assert.equal(bands.reduce((sum,b)=>sum+b.height,0),512);
    assert.ok(bands.length>2&&bands.length<40);
    assert.ok(bands.some(b=>b.height>20));
    for(const b of bands){assert.ok(b.red>=1&&b.red<=255);all.push(b.red);}
  }
  assert.ok(all.some(r=>r<128));assert.ok(all.some(r=>r>128));assert.ok(all.some(r=>r===128));
  assert.deepEqual(buildLineMap(8),buildLineMap(8));
  assert.notDeepEqual(buildLineMap(8),buildLineMap(15));
  assert.equal(lineBlockAt(.01,1),lineBlockAt(.02,1));
  for(let t=0;t<=100;t+=.25)assert.ok(buildLineMap(t).bands.length<=64);
});

test('Actual hero filter fixes vertical channel at exactly half and excludes RGB splitting',async()=>{
  const {readFile}=await import('node:fs/promises');
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/<feDisplacementMap[^>]+in="SourceGraphic"[^>]+xChannelSelector="R"[^>]+yChannelSelector="G"/);
  assert.match(html,/<feFuncG type="linear" slope="0" intercept="0.5"/);
  assert.ok(!html.includes('hero-rgb-v4')&&!html.includes('rgb-red-offset'));
});
