import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {institutionMarkVisible} from '../lib/institution-display.js';import {institutionRow} from '../lib/paper-media.js';
const report=JSON.parse(await readFile(new URL('../docs/school-marks-progress-2026-11-03.json',import.meta.url)));
const registry=JSON.parse(await readFile(new URL('../data/institutions.json',import.meta.url)));
test('rolling school completion keeps exact existing identities and truthful pending counts',()=>{
 assert.equal(report.completed.length,report.completedCount);assert.equal(report.remaining.length,report.remainingCount);assert.equal(report.originalMissing,report.completedCount+report.remainingCount);
 const ids=[...report.completed,...report.remaining].map(r=>r.id);assert.equal(new Set(ids).size,report.originalMissing);assert.match(report.scope,/not QS/);
 for(const r of report.completed){const i=registry.institutions.find(i=>i.id===r.id);assert.ok(i);assert.equal(i.officialName,r.name);assert.deepEqual(i.logo,r.logo);assert.equal(i.logo.sha256,r.sha256);assert.ok(institutionMarkVisible(i.logo,i.markType));assert.equal(i.displayScope,'paper-affiliation-only');assert.equal(i.rightsStatus,'not-separately-authorized');assert.ok(institutionRow({visuals:{institutions:[{...i,name:i.officialName}]}}).includes(i.logo.path));}
});
