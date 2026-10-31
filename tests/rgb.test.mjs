import test from 'node:test';
import assert from 'node:assert/strict';
import {v4Split} from '../lib/rgb-split.js';
test('V4 quantized source formula and bounded displacement',()=>{const a=v4Split(10.21),b=v4Split(10.29),c=v4Split(10.3);assert.equal(a.tick,102);assert.deepEqual(a,b);assert.equal(c.tick,103);const n=Math.sin(102*12.9898+2*78.233)*43758.5453;assert.equal(a.noise,n-Math.floor(n));assert.equal(a.amount,.02*.1*a.noise);assert.ok(a.amount>=0&&a.amount<.002);});
