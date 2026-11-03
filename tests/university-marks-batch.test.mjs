import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {institutionRow,authorRow} from '../lib/paper-media.js';
import {institutionGallery} from '../lib/institutions.js';
import {institutionMarkVisible,institutionMarkNeedsOwnRow} from '../lib/institution-display.js';
const report=JSON.parse(await readFile(new URL('../docs/university-marks-batch-2026-11-03.json',import.meta.url)));
const registry=JSON.parse(await readFile(new URL('../data/institutions.json',import.meta.url)));
const transparent=JSON.parse(await readFile(new URL('../docs/university-transparency-2026-11-03.json',import.meta.url)));
test('15 reviewed university marks are complete compact paper symbols with independent names',()=>{
 assert.equal(report.records.length,15);assert.equal(new Set(report.records.map(r=>r.id)).size,15);
 for(const source of report.records){const i=registry.institutions.find(i=>i.id===source.id);assert.equal(i.status,'verified');const superseding=transparent.changes.find(x=>x.id===source.id);if(superseding){assert.deepEqual(superseding.original.logo,source.logo);assert.deepEqual(i.logo,superseding.logo);}else assert.deepEqual(i.logo,source.logo);assert.ok(institutionMarkVisible(i.logo,i.markType));assert.equal(institutionMarkNeedsOwnRow(i.logo),false);assert.equal(i.displayScope,'paper-affiliation-only');assert.equal(i.rightsStatus,'not-separately-authorized');
 const p={authors:['Test Author'],visuals:{institutions:[{...i,name:i.officialName,institutionId:i.id,authorNames:['Test Author']}]}};
 const html=institutionRow(p);assert.ok(html.includes(i.logo.path));assert.ok(authorRow(p).includes('Test Author'));assert.ok(html.includes('<span>'));assert.ok(!institutionGallery([p],registry).includes('<img'));
 }
});
test('shared emblems, vector derivation, native backgrounds and mirror provenance are honest',()=>{
 const find=id=>report.records.find(r=>r.id===id);
 assert.match(find('pending-university-of-chinese-academy-of-sciences').note,/shared|Shared/);
 assert.match(find('pending-tianjin-university').note,/mirror|Mirror/);
 assert.equal(find('pending-carnegie-mellon-university').alphaStatus,'opaque-light');
 assert.equal(find('pending-the-university-of-hong-kong').logo.background,'transparent');
 assert.match(report.scope,/not.*QS/);
});
