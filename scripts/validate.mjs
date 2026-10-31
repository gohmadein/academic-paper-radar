import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';
import {validateIndex, validateDay} from '../lib/model.js';

export const root = fileURLToPath(new URL('../', import.meta.url));
export async function validateAll(base = root) {
  const errors = [];
  let count = 0;
  for (const [directory,demo] of [['data',false],['data/demo',true]]) {
    const path = join(base,directory);
    let index;
    try { index = JSON.parse(await readFile(join(path,'index.json'),'utf8')); }
    catch { errors.push(`${directory}/index.json: 无法读取 JSON`); continue; }
    const indexErrors = validateIndex(index);
    errors.push(...indexErrors.map(e => `${directory}: ${e}`));
    if (indexErrors.length) continue;
    const ids = new Set();
    for (const entry of index.days) {
      let day;
      try { day = JSON.parse(await readFile(join(path,entry.file),'utf8')); }
      catch { errors.push(`${directory}/${entry.file}: 无法读取 JSON`); continue; }
      errors.push(...validateDay(day,{demo}).map(e => `${directory}/${entry.file}: ${e}`));
      if (day.date !== entry.date || day.title !== entry.title || day.papers?.length !== entry.count) errors.push(`${directory}/${entry.file}: 日期、标题或数量与索引不一致`);
      if (Array.isArray(day.papers)) for (const p of day.papers) {
        if (ids.has(p.id)) errors.push(`${directory}: 跨日期重复 id ${p.id}`);
        ids.add(p.id);
        if (!demo && JSON.stringify(p).includes('example.com/replace-with')) errors.push(`${p.id}: 仍使用模板来源`);
      }
      count++;
    }
    const files = await readdir(join(path,'days')).catch(error => error.code==='ENOENT' ? [] : Promise.reject(error));
    for (const file of files) if (!index.days.some(e => e.file===`days/${file}`)) errors.push(`${directory}/days/${file}: 未写入日期索引`);
  }
  return {errors,count};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateAll();
  if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
  else console.log(`数据校验通过：${result.count} 个日报文件（真实与演示分开校验）。`);
}
