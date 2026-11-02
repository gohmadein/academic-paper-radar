// Private browser-local calendar tasks. Never shared with research data or paper notes.
export const CALENDAR_TASKS_KEY = 'paper-signal-calendar-tasks-v1';
export const MAX_TASK_LENGTH = 2000;
export const MAX_CALENDAR_TASKS = 1000;
export const MAX_CALENDAR_TASKS_BYTES = 1024 * 1024;
function validateProfile(profile) {
  if(!['xun','li','lv'].includes(profile))throw new Error('私人事项所属订阅无效');
  return profile;
}
export function calendarTaskKey(profile='xun') {
  return validateProfile(profile)==='xun'?CALENDAR_TASKS_KEY:`${CALENDAR_TASKS_KEY}-${profile}`;
}
const FORMAT = 'paper-signal-calendar-tasks';
const ID = /^[a-z0-9][a-z0-9-]{0,99}$/;
const validID = id => typeof id === 'string' && ID.test(id) && !['constructor','prototype','__proto__'].includes(id);
const bytes = text => new TextEncoder().encode(text).length;
const copy = task => task ? {...task} : undefined;
function validDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
function validTimestamp(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return false;
  const date=new Date(value);return Number.isFinite(date.getTime())&&date.toISOString()===value;
}
function validateEntries(entries) {
  if(!Array.isArray(entries)||entries.length>MAX_CALENDAR_TASKS)throw new Error('私人事项最多 1000 条');
  const tasks=new Map();
  for(const task of entries){
    if(!task||typeof task!=='object'||Array.isArray(task)||Object.keys(task).some(key=>!['id','date','text','done','updatedAt'].includes(key))||!validID(task.id)||!validDate(task.date)||typeof task.text!=='string'||!task.text.trim()||task.text.length>MAX_TASK_LENGTH||typeof task.done!=='boolean'||!validTimestamp(task.updatedAt)||tasks.has(task.id))throw new Error('私人事项 ID、日期、内容或格式无效（每条最多 2000 字符）');
    tasks.set(task.id,copy(task));
  }
  return tasks;
}
export function makeCalendarTasksExport(tasks,{profile='xun'}={}) {
  validateProfile(profile);
  const entries=tasks instanceof Map?[...tasks.values()]:[...tasks];
  const validated=[...validateEntries(entries).values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const serialized=JSON.stringify({format:FORMAT,version:1,...(profile==='xun'?{}:{profile}),tasks:validated},null,2)+'\n';
  if(bytes(serialized)>MAX_CALENDAR_TASKS_BYTES)throw new Error('私人事项备份总量最多 1 MiB，请先备份并整理');
  return serialized;
}
export function parseCalendarTasksImport(text,{profile='xun'}={}) {
  validateProfile(profile);
  if(typeof text!=='string'||bytes(text)>MAX_CALENDAR_TASKS_BYTES)throw new Error('私人事项文件最多 1 MiB');
  let value;try{value=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('无法解析私人事项 JSON');}
  if(!value||typeof value!=='object'||Array.isArray(value)||value.format!==FORMAT||value.version!==1||Object.keys(value).some(key=>!['format','version','profile','tasks'].includes(key)))throw new Error('请选择私人事项备份；不能导入书签、论文笔记或会议资料');
  const sourceProfile=Object.hasOwn(value,'profile')?validateProfile(value.profile):'xun';
  if(sourceProfile!==profile)throw new Error('私人事项备份属于其他订阅，不能混合导入');
  return validateEntries(value.tasks);
}
const sameTask=(a,b)=>a.date===b.date&&a.text===b.text&&a.done===b.done;
export function mergeCalendarTasks(existing,incoming) {
  const tasks=validateEntries(existing instanceof Map?[...existing.values()]:existing);
  const validated=validateEntries(incoming instanceof Map?[...incoming.values()]:incoming);
  let added=0,duplicates=0,conflicts=0;
  for(const [id,task] of validated){
    if(!tasks.has(id)){tasks.set(id,copy(task));added++;}
    else if(sameTask(tasks.get(id),task))duplicates++;
    else conflicts++;
  }
  makeCalendarTasksExport(tasks);
  return {tasks,added,duplicates,conflicts};
}

export function createCalendarTaskStore(storage,{profile='xun'}={}) {
  const key=calendarTaskKey(profile),options={profile};
  let tasks=new Map(),baseRaw=null,dirty=false,loadError=false,conflict=false,error='',sequence=0;
  const timestamp=()=>new Date(storage.now?storage.now():Date.now()).toISOString();
  function load(){
    try{
      const raw=storage.getItem(key),loaded=raw===null?new Map():parseCalendarTasksImport(raw,options);
      tasks=loaded;baseRaw=raw;dirty=false;loadError=false;conflict=false;error='';return true;
    }catch{loadError=true;error='本机私人事项未能读取，已停止写入以保护原记录';return false;}
  }
  function checkBase(){
    if(loadError)throw new Error('本机私人事项未能读取，已停止写入以保护原记录');
    if(conflict||storage.getItem(key)!==baseRaw){conflict=true;throw new Error('其他标签页已修改私人事项，请先导出本页草稿，再重新加载');}
  }
  function newID(){
    let id;do{
      const uuid=globalThis.crypto?.randomUUID?.();
      id='task-'+(uuid||`${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2,12)}`);
    }while(tasks.has(id));return id;
  }
  load();
  return {
    list(date){return [...tasks.values()].filter(task=>date===undefined||task.date===date).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(copy);},
    get:id=>copy(tasks.get(id)),
    get dirty(){return dirty;},get loadError(){return loadError;},get conflict(){return conflict;},get error(){return error;},
    set(input){
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['id','date','text','done'].includes(key)))throw new Error('私人事项输入格式无效');
      const id=input.id===undefined?newID():input.id,old=tasks.get(id);
      const task={id,date:input.date,text:input.text,done:input.done===undefined?(old?.done||false):input.done,updatedAt:timestamp()};
      validateEntries([task]);
      if(old&&sameTask(old,task))return copy(old);
      const next=new Map(tasks);next.set(id,task);makeCalendarTasksExport(next,options);
      tasks=next;dirty=true;return copy(task);
    },
    remove(id){if(!tasks.has(id))return false;tasks.delete(id);dirty=true;return true;},
    flush(){
      try{
        checkBase();if(!dirty){error='';return true;}
        const serialized=makeCalendarTasksExport(tasks,options);storage.setItem(key,serialized);baseRaw=serialized;dirty=false;error='';return true;
      }catch(cause){error=cause?.message?.includes('标签页')||loadError?cause.message:'尚未保存：浏览器存储不可用或空间不足；草稿仍在本页，请重试或导出';return false;}
    },
    export:()=>makeCalendarTasksExport(tasks,options),
    import(text){
      try{
        checkBase();const result=mergeCalendarTasks(tasks,parseCalendarTasksImport(text,options));
        const serialized=makeCalendarTasksExport(result.tasks,options);storage.setItem(key,serialized);
        tasks=result.tasks;baseRaw=serialized;dirty=false;error='';
        return {added:result.added,duplicates:result.duplicates,conflicts:result.conflicts};
      }catch(cause){error=cause.message||'私人事项导入失败；原记录未改动';throw new Error(error);}
    },
    reload(){
      if(dirty){error='本页尚有未保存草稿，请先导出备份，再重新加载';return false;}
      return load();
    }
  };
}
