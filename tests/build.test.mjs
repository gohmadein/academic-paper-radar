import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

test('Production entry points and dependency imports share a deterministic content version',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const build=()=>execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'pipe'});
  build();
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
  const version=html.match(/src="\.\/app\.js\?v=([a-f0-9]{12})"/)?.[1];
  assert.ok(version);
  for(const [,asset] of html.matchAll(/(?:src|href)="(\.\/[^"?]+\.(?:js|css|svg))\?v=[a-f0-9]+"/g))await access(new URL('../dist/'+asset.slice(2),import.meta.url));
  const imports=[...app.matchAll(/from '(\.[^'?]+\.js)\?v=([a-f0-9]+)'/g)];
  const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
  assert.equal(imports.length,[...source.matchAll(/from '\.[^']+\.js'/g)].length);
  assert.ok(imports.some(([,asset])=>asset==='./lib/topics.js'));
  for(const [,asset,revision] of imports){assert.equal(revision,version);await access(new URL('../dist/'+asset.slice(2),import.meta.url));}
  assert.ok(app.includes(`favicon.svg?v=${version}`));
  assert.ok(imports.some(([,asset])=>asset==='./lib/profile-icons.js'));
  assert.equal(await readFile(new URL('../dist/lib/profile-icons.js',import.meta.url),'utf8'),await readFile(new URL('../lib/profile-icons.js',import.meta.url),'utf8'));
  for(const module of ['digest-view','source-directory'])assert.ok((await readFile(new URL('../dist/lib/'+module+'.js',import.meta.url),'utf8')).includes(`./profile-icons.js?v=${version}`));
  for(const name of ['source-registry.json','profile-watchlists.json']){
    assert.deepEqual(JSON.parse(await readFile(new URL('../dist/config/'+name,import.meta.url),'utf8')),JSON.parse(await readFile(new URL('../config/'+name,import.meta.url),'utf8')));
  }
  const manifest=await readFile(new URL('../dist/checksums.txt',import.meta.url),'utf8');
  build();
  assert.equal(await readFile(new URL('../dist/checksums.txt',import.meta.url),'utf8'),manifest);
});
