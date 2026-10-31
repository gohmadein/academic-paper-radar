import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {profileIcon} from '../lib/profile-icons.js';
import {digestBadges} from '../lib/digest-view.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('Three self-contained geometric identities are safe, transparent and decorative',()=>{
 const marks=['xun','li','lv'].map(profileIcon);
 assert.equal(new Set(marks).size,3);
 for(const [i,svg] of marks.entries()){
  assert.match(svg,/viewBox="0 0 32 32"/);
  assert.ok(svg.includes(`data-profile-icon="${['xun','li','lv'][i]}"`));
  assert.match(svg,/aria-hidden="true" focusable="false"/);
  assert.match(svg,/<path /);
  assert.doesNotMatch(svg,/<(?:text|image|script|foreignObject|animate|rect)\b|\bon\w+=|\b(?:href|id)=|white|#fff/i);
 }
 for(const key of ['all','toString','__proto__','<img>'])assert.equal(profileIcon(key),'');
});

test('Marks supplement real names in badges and replace only sidebar symbol glyphs',async()=>{
 const badge=digestBadges({profiles:['xun','li','lv'],novelty:'recent',publicationStatus:'preprint',readDepth:'abstract'});
 for(const [key,label] of [['xun','迅'],['li','李'],['lv','驴']])assert.ok(badge.includes(profileIcon(key)+label));
 const app=await read('app.js'),css=await read('styles.css');
 assert.ok(app.includes(':profileIcon(k)}</span><span class="profile-link-copy">'));
 assert.ok(app.includes("PROFILES[k].label+' · '+PROFILES[k].description"));
 assert.ok(css.includes('.profile-symbol .profile-identity{width:30px;height:30px;fill:currentColor;stroke:none}'));
 assert.ok(css.includes('@media(max-width:800px){.profile-symbol .profile-identity{width:24px;height:24px}}'));
 assert.ok((await read('scripts/build.mjs')).includes("'lib'"));
});
