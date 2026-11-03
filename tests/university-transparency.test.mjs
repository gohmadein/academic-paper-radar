import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';
const root=new URL('../',import.meta.url),report=JSON.parse(await readFile(new URL('docs/university-transparency-2026-11-03.json',root))),registry=JSON.parse(await readFile(new URL('data/institutions.json',root)));
test('transparent replacements retain original evidence and exact current bytes without claiming all backgrounds resolved',async()=>{
 assert.equal(report.display.width,40);assert.equal(report.display.height,32);assert.equal(report.display.objectFit,'contain');assert.ok(report.remaining.length>0);assert.equal(new Set(report.changes.map(x=>x.id)).size,report.changes.length);
 for(const row of report.changes){const current=registry.institutions.find(x=>x.id===row.id);assert.ok(current);assert.deepEqual(current.logo,row.logo);assert.equal(row.logo.background,'transparent');assert.equal(createHash('sha256').update(await readFile(new URL(row.logo.path,root))).digest('hex'),row.logo.sha256);if(row.original.logo){assert.equal(createHash('sha256').update(await readFile(new URL(row.original.logo.path,root))).digest('hex'),row.original.logo.sha256);}}
 for(const row of report.remaining)assert.ok(!report.changes.some(x=>x.id===row.id));
});
