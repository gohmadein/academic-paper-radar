import {mkdir,cp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {root,validateAll} from './validate.mjs';

const result = await validateAll();
if(result.errors.length) throw new Error(result.errors.join('\n'));
const out = resolve(root,'dist');
if (!out.startsWith(resolve(root)+sep) || out !== resolve(root,'dist')) throw new Error('不安全的构建目标');
// Only delete the verified generated dist directory inside this project.
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for (const file of ['index.html','styles.css','app.js','lib','data','THIRD_PARTY_NOTICES.txt']) await cp(join(root,file),join(out,file),{recursive:true});
await mkdir(join(out,'config'),{recursive:true});
for(const file of ['source-registry.json','profile-watchlists.json']) await cp(join(root,'config',file),join(out,'config',file));
// Publish only referenced, validated research assets, plus the site's own mark/fonts.
// Source-review archives or restricted unused logos must never enter dist.
for(const file of ['assets/favicon.svg','assets/fonts','assets/decor/li-photo-1.18b7a0d61d5b.webp','assets/decor/li-photo-2.e809542ba20c.webp','assets/decor/xun-gundam-left.c9ffc9b7ef13.webp','assets/decor/xun-gundam-right.3561f752a59e.webp',...result.assets]){await mkdir(resolve(out,file,'..'),{recursive:true});await cp(join(root,file),join(out,file),{recursive:true});}
// Pages caches files independently. Version all entry assets and module imports
// together so new HTML cannot execute an older, incompatible cached app module.
async function runtimeFiles(path){
  const files=[];
  for(const entry of (await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
    const file=join(path,entry.name);
    if(entry.isDirectory())files.push(...await runtimeFiles(file));
    else if(/\.(?:html|css|js|svg|woff2)$/.test(file))files.push(file);
  }
  return files;
}
const files=await runtimeFiles(out);
const revisionHash=createHash('sha256');
for(const file of files)revisionHash.update(await readFile(file));
const version=revisionHash.digest('hex').slice(0,12);
for(const file of files.filter(file=>/\.(?:html|css|js)$/.test(file))){
  let text=await readFile(file,'utf8');
  text=text.replace(/(\b(?:src|href)=["'])(\.\/[^"']+\.(?:js|css|svg))(["'])/g,`$1$2?v=${version}$3`);
  text=text.replace(/(\bfrom\s*["'])(\.[^"']+\.js)(["'])/g,`$1$2?v=${version}$3`);
  text=text.replace(/(url\(["']?)(\.\/[^"')]+\.woff2)(["']?\))/g,`$1$2?v=${version}$3`);
  await writeFile(file,text);
}
await writeFile(join(out,'.nojekyll'),'');
async function inventory(path,prefix='') {
  const items=[];
  for(const entry of (await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
    const name=prefix+entry.name;
    if(entry.isDirectory()) items.push(...await inventory(join(path,entry.name),name+'/'));
    else items.push(`${createHash('sha256').update(await readFile(join(path,entry.name))).digest('hex')}  ${name}`);
  }
  return items;
}
await writeFile(join(out,'checksums.txt'),(await inventory(out)).join('\n')+'\n');
console.log('静态站点已生成：dist/（无依赖安装，无服务器运行时）。');
