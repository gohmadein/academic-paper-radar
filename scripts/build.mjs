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
for (const file of ['index.html','styles.css','hud.css','app.js','assets','lib','data','THIRD_PARTY_NOTICES.txt']) await cp(join(root,file),join(out,file),{recursive:true});
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
