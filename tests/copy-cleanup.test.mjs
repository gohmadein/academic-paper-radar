import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {editorialCard,digestDetails} from '../lib/digest-view.js';
import {institutionGallery} from '../lib/institutions.js';
import {figurePanel} from '../lib/paper-media.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const day=JSON.parse(await read('data/days/2026-10-31.json'));
const institutions=JSON.parse(await read('data/institutions.json'));
test('Cards and gallery omit generic filler but retain scientific text, links and provenance',()=>{
  const before=JSON.stringify(day);
  for(const [index,paper] of day.papers.entries()){
    const card=editorialCard(paper,index,{}),details=digestDetails(paper);
    assert.ok(!card.includes('原始来源 / 外部网站'));
    assert.ok(card.includes(paper.titleEn.replaceAll('&','&amp;')));
    assert.ok(card.includes(paper.summary.replaceAll('&','&amp;')));
    assert.ok(details.includes('发表状态'));
    assert.ok(details.includes('阅读深度'));
    assert.ok(details.includes('原始证据'));
  }
  const gallery=institutionGallery(day.papers,institutions);
  assert.ok(!gallery.includes('institution-library-note'));
  assert.ok(gallery.includes('标识来源'));assert.ok(gallery.includes('官方来源'));
  assert.ok(gallery.includes('左右方向键'));
  const missing=figurePanel({title:'Test'});
  assert.ok(!missing.includes('<figcaption>'));
  assert.ok(missing.includes('已核验主图暂不可用，可查看原始来源。'));
  assert.equal(JSON.stringify(day),before);
});
