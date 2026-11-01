import {escapeHTML as e} from './model.js';
export function noteButton(p,hasNote=false) {
  const label=hasNote?'编辑笔记（已有内容）':'添加笔记';
  return `<button class="note-button ${hasNote?'has-note':''}" data-note="${e(p.id)}" data-note-title="${e(p.title)}" aria-label="${label}：${e(p.title)}" title="${label}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M13 4H5v16h14v-8M10 14l1-4 8-8 3 3-8 8-4 1zM17 4l3 3"/></svg><span class="note-dot" aria-hidden="true"></span></button>`;
}
