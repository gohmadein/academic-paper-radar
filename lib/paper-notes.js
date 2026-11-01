export const NOTES_KEY = 'paper-signal-notes-v1';
export const MAX_NOTE_LENGTH = 10000;
export const MAX_NOTES = 5000;
export const MAX_NOTES_BYTES = 2 * 1024 * 1024;
const ID = /^[a-z0-9][a-z0-9-]{0,99}$/;
const validID = id => typeof id === 'string' && ID.test(id) && !['constructor','prototype','__proto__'].includes(id);
function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length > MAX_NOTES) throw new Error('笔记数量无效（最多 5000 条）');
  const notes = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some(k=>!['id','text'].includes(k)) || !validID(entry.id) || typeof entry.text !== 'string' || entry.text.length > MAX_NOTE_LENGTH || !entry.text.length || notes.has(entry.id)) throw new Error('笔记 ID、内容或长度无效');
    notes.set(entry.id,entry.text);
  }
  return notes;
}
export function makeNotesExport(notes) {
  const entries = [...notes].sort(([a],[b])=>a.localeCompare(b)).map(([id,text])=>({id,text}));
  validateEntries(entries);
  const serialized = JSON.stringify({format:'paper-signal-notes',version:1,notes:entries},null,2)+'\n';
  if (new TextEncoder().encode(serialized).length > MAX_NOTES_BYTES) throw new Error('笔记总量超过 2 MB，请复制备份后整理');
  return serialized;
}
export function parseNotesImport(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_NOTES_BYTES) throw new Error('文件过大：最多 2 MB');
  let value;
  try { value = JSON.parse(text.replace(/^\uFEFF/,'')); } catch { throw new Error('无法解析笔记 JSON'); }
  if (!value || value.format !== 'paper-signal-notes' || value.version !== 1 || Object.keys(value).some(k=>!['format','version','notes'].includes(k))) throw new Error('请选择本站导出的笔记 JSON；书签请在书签迁移中导入');
  return validateEntries(value.notes);
}
export function mergeNotes(existing,incoming) {
  const notes = new Map(existing); let added=0, conflicts=0, duplicates=0;
  for (const [id,text] of incoming) {
    if (!notes.has(id)) { notes.set(id,text); added++; }
    else if (notes.get(id) === text) duplicates++;
    else conflicts++;
  }
  makeNotesExport(notes);
  return {notes,added,conflicts,duplicates};
}
// Keep session drafts even when persistence fails. Never claim those drafts are saved.
export function createNotesStore(storage) {
  let notes = new Map(), dirty=false, loadError=false, baseRaw=null, conflict=false;
  try { const raw=storage.getItem(NOTES_KEY); baseRaw=raw; if(raw!==null) notes=parseNotesImport(raw); } catch { loadError=true; }
  return {
    get:id=>notes.get(id)||'', has:id=>notes.has(id),
    get dirty(){return dirty;}, get loadError(){return loadError;}, get conflict(){return conflict;},
    set(id,text) {
      if (!validID(id) || typeof text!=='string' || text.length>MAX_NOTE_LENGTH) throw new Error('笔记过长：最多 10000 字符');
      if ((notes.get(id)||'')===text) return;
      if (text) notes.set(id,text); else notes.delete(id);
      dirty=true;
    },
    flush() {
      if (loadError) return false; // Do not overwrite unreadable or corrupt original storage.
      if (!dirty) return true;
      try {
        if(storage.getItem(NOTES_KEY)!==baseRaw){conflict=true;return false;}
        const text=makeNotesExport(notes);storage.setItem(NOTES_KEY,text);baseRaw=text;dirty=false;return true;
      } catch { return false; }
    },
    export:(id)=>makeNotesExport(id ? new Map(notes.has(id)?[[id,notes.get(id)]]:[]) : notes),
    import(text) {
      if (loadError) throw new Error('本机笔记未能读取，已停止导入以保护原记录');
      const result=mergeNotes(notes,parseNotesImport(text));
      if(storage.getItem(NOTES_KEY)!==baseRaw){conflict=true;throw new Error('另一标签页已修改笔记，请先导出本页草稿再重新加载');}
      const serialized=makeNotesExport(result.notes);storage.setItem(NOTES_KEY,serialized);baseRaw=serialized;
      notes=result.notes; dirty=false; return result;
    }
  };
}
