import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolveInstitution,validateInstitutions,institutionGallery} from '../lib/institutions.js';
import {institutionRow} from '../lib/paper-media.js';
import {bulletinPapers,validateArxivInstitutions} from '../lib/arxiv-bulletin.js';
const load=async p=>JSON.parse(await readFile(new URL(`../${p}`,import.meta.url)));

test('MIT current source mark resolves by alias and appears only on evidenced paper affiliations',async()=>{
 const registry=await load('data/institutions.json');const record=resolveInstitution(registry,' MIT ');
 assert.equal(record.id,'pending-massachusetts-institute-of-technology');assert.equal(record.markType,'compact-symbol');
 assert.equal(record.displayScope,'paper-affiliation-only');assert.equal(record.rightsStatus,'not-separately-authorized');
 const bytes=await readFile(new URL(`../${record.logo.path}`,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),record.logo.sha256);
 assert.match(bytes.toString(),/fill="#750014"/);assert.equal(record.logo.background,'transparent');
 for(const [date,id] of [['2026-11-02','arxiv-2303-04137'],['2026-11-03','arxiv-2607-11734']]){
  const day=await load(`data/days/${date}.json`),paper=day.papers.find(p=>p.id===id),row=paper.visuals.institutions.find(x=>x.institutionId===record.id);
  assert.deepEqual(row.logo,record.logo);assert.ok(row.evidence.length);assert.match(institutionRow(paper),/mit-2023-red-logo\.svg/);
  assert.doesNotMatch(institutionGallery([paper],registry),/mit-2023-red-logo\.svg/);
  assert.deepEqual(validateInstitutions(registry,day.papers),[]);
 }
 const bulletin=await load('data/arxiv/days/2026-11-02.json');assert.deepEqual(validateArxivInstitutions(bulletin,registry),[]);
 const mitPapers=bulletinPapers(bulletin,registry).filter(p=>p.visuals?.institutions.some(i=>i.institutionId===record.id));assert.equal(mitPapers.length,4);
 for(const p of mitPapers)assert.match(institutionRow(p),/mit-2023-red-logo\.svg/);
});
