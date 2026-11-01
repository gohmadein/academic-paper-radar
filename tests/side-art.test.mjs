import test from 'node:test';
import assert from 'node:assert/strict';
import {sideArtLayout} from '../lib/side-art.js';
function layout(viewport,collapsed=false){const rail=collapsed?76:222,main=Math.min(viewport-rail,collapsed?1160:1120),left=rail+(viewport-rail-main)/2;return sideArtLayout({viewportWidth:viewport,mainLeft:left,mainRight:left+main,railRight:rail});}
test('Art uses actual gutters and reacts to sidebar width without shrinking the reading column',()=>{
  for(const [width,expanded,collapsed] of [[1165,false,false],[1366,false,true],[1440,true,true],[1536,true,true],[1650,true,true],[1920,true,true]]){
    assert.equal(layout(width).visible,expanded,`expanded ${width}`);
    assert.equal(layout(width,true).visible,collapsed,`collapsed ${width}`);
  }
  assert.equal(layout(1536).leftWidth,73);assert.equal(layout(1440,true).leftWidth,78);
  assert.equal(layout(3840).leftWidth,1225);
});
test('Mobile, absent layout and asymmetric insufficient gutters are hidden safely',()=>{
  assert.equal(layout(800).visible,false);
  assert.equal(sideArtLayout({}).visible,false);
  assert.equal(sideArtLayout({viewportWidth:1600,mainLeft:300,mainRight:1585,railRight:76}).visible,false);
});
