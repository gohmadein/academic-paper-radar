import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateXunSelection} from '../lib/xun-selection.js';
const rules=JSON.parse(await readFile(new URL('../config/digest-rules.json',import.meta.url)));
const day=(status,profiles=['xun'],date='2026-11-04')=>({date,papers:[{id:'arxiv-test',profiles,publicationStatus:status,identity:{arxiv:'2601.12345'}}]});
test('future Xun preprints and unknown status are excluded without rejecting official papers with arxiv links',()=>{
 for(const s of ['preprint','unknown'])assert.equal(validateXunSelection(day(s),rules).length,1);
 for(const s of ['accepted','published','workshop'])assert.deepEqual(validateXunSelection(day(s),rules),[]);
});
test('historic Xun and other profiles remain valid; shared paper must meet Xun gate',()=>{
 assert.deepEqual(validateXunSelection(day('preprint',['xun'],'2026-11-03'),rules),[]);
 for(const profile of ['li','lv'])assert.deepEqual(validateXunSelection(day('preprint',[profile]),rules),[]);
 assert.equal(validateXunSelection(day('preprint',['xun','lv']),rules).length,1);
});
test('selection keeps soft3:2 ratio, unchanged quota and no forced minimum',()=>{
 const x=rules.profiles.xun,p=x.curatedPublicationPolicy;
 assert.deepEqual([x.targetMin,x.targetMax],[3,5]);assert.deepEqual(p.conferenceToJournalTarget,[3,2]);assert.equal(p.ratioIsSoft,true);
 assert.deepEqual(validateXunSelection({date:'2026-11-04',papers:[]},rules),[]);
 assert.match(x.selectionPriority.join(' '),/机器人学习.*具身智能/);assert.match(x.selectionPriority.join(' '),/官方/);
});
