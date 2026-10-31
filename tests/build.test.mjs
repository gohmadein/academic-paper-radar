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
  assert.equal(imports.length,7);
  for(const [,asset,revision] of imports){assert.equal(revision,version);await access(new URL('../dist/'+asset.slice(2),import.meta.url));}
  assert.ok(app.includes(`favicon.svg?v=${version}`));
  const manifest=await readFile(new URL('../dist/checksums.txt',import.meta.url),'utf8');
  build();
  assert.equal(await readFile(new URL('../dist/checksums.txt',import.meta.url),'utf8'),manifest);
});
