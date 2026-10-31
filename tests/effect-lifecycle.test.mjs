import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeroRGBEffect} from '../lib/rgb-split.js';

test('RGB lifecycle pauses on routes, hidden tabs, off switch and reduced motion',()=>{
  const names=['document','window','matchMedia','localStorage','ResizeObserver','setTimeout','clearTimeout'];
  const old=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)]));
  const events={},mediaEvents={},buttonEvents={},classes=new Set(),attributes={};
  const button={disabled:false,textContent:'',setAttribute:(k,v)=>attributes[k]=v,addEventListener:(k,v)=>buttonEvents[k]=v};
  const hero={classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},getBoundingClientRect:()=>({width:1000})};
  const offset={setAttribute(){}};
  const media={matches:false,addEventListener:(k,v)=>mediaEvents[k]=v};
  let scheduled=0;
  try{
    Object.assign(globalThis,{document:{hidden:false,getElementById:id=>id==='hero'?hero:id==='rgb-toggle'?button:offset,addEventListener:(k,v)=>events[k]=v},window:{addEventListener(){}},matchMedia:()=>media,localStorage:{getItem:()=>null,setItem(){}},ResizeObserver:class{observe(){}},setTimeout:()=>{scheduled++;return 1;},clearTimeout:()=>{scheduled--;}});
    const effect=createHeroRGBEffect();
    assert.equal(scheduled,0);
    effect.setVisible(true);assert.equal(scheduled,1);assert.ok(classes.has('rgb-enabled'));
    effect.setVisible(false);assert.equal(scheduled,0);assert.ok(!classes.has('rgb-enabled'));
    effect.setVisible(true);document.hidden=true;events.visibilitychange();assert.equal(scheduled,0);
    document.hidden=false;events.visibilitychange();assert.equal(scheduled,1);
    buttonEvents.click();assert.equal(scheduled,0);assert.equal(attributes['aria-pressed'],'false');
    buttonEvents.click();assert.equal(scheduled,1);
    media.matches=true;mediaEvents.change();assert.equal(scheduled,0);assert.equal(button.disabled,true);assert.equal(attributes['aria-pressed'],'false');
  }finally{for(const [name,desc] of old)desc?Object.defineProperty(globalThis,name,desc):delete globalThis[name];}
});
