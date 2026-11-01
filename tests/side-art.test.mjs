import test from 'node:test';
import assert from 'node:assert/strict';
import {sideArtLayout} from '../lib/side-art.js';
function layout(viewport,collapsed=false){return sideArtLayout({viewportWidth:viewport,railRight:collapsed?76:222});}
test('Two panels fill reading viewport without overlap or rail intrusion at every width',()=>{
 for(const width of [320,390,800,801,1165,1366,1440,1536,1920,2048,3840])for(const collapsed of [false,true]){
  const a=layout(width,collapsed),start=width<=800?0:collapsed?76:222;
  assert.equal(a.visible,true);assert.equal(a.leftStart,start);
  assert.equal(a.leftStart+a.leftWidth,a.rightStart);
  assert.equal(a.rightStart+a.rightWidth,width);
  assert.equal(a.leftWidth,a.rightWidth);
 }
 assert.equal(layout(1165).leftWidth,471.5);
 assert.equal(layout(1440,true).leftWidth,682);
});
test('Missing/invalid measurements fail safely, absent gutters do not hide art',()=>{
 assert.equal(sideArtLayout({}).visible,false);
 assert.equal(sideArtLayout({viewportWidth:0,railRight:0}).visible,false);
 assert.equal(sideArtLayout({viewportWidth:1000,railRight:1000}).visible,false);
 assert.equal(sideArtLayout({viewportWidth:1165,railRight:222,mainLeft:222,mainRight:1165}).visible,true);
});
test('Main width and document scroll never affect fixed background coordinates',()=>{
 const measured={viewportWidth:2048,mainLeft:575,mainRight:1695,railRight:222};
 const a=sideArtLayout({...measured,scrollY:0}),b=sideArtLayout({...measured,mainLeft:300,mainRight:1900,scrollY:12000});
 assert.deepEqual(a,b);assert.equal(a.leftStart,222);assert.equal(a.rightStart,1135);
});
test('Darkest 22% line art under white glass retains readable text contrast',()=>{
 const lum=rgb=>rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
 const bg=255*(1-.22),card=bg+(255-bg)*(133/255);
 const contrast=(fg,b)=>(lum([b,b,b])+.05)/(lum(fg)+.05);
 assert.ok(contrast([53,67,88],bg)>=4.5);
 assert.ok(contrast([18,59,115],bg)>=4.5);
 assert.ok(contrast([82,98,122],card)>=4.5);
});
