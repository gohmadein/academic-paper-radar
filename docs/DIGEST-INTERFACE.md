# 日报 v2 输入接口（研究记录交接）

研究方交付一个完整 JSON，根字段如下。正式日报只接收核验后的真实记录；不要填虚构作者、出处、结论或资源。不能取得的资源用 null，不用占位链接。

```json
{
  "version": 2,
  "date": "2026-10-31",
  "title": "2026-10-31 零域论文精选",
  "demo": false,
  "timezone": "Asia/Shanghai",
  "issueNote": "本期实际检索范围与不足；少于目标数量时说明，不强行补足。",
  "coverage": {"checkedSources": [], "limitations": []},
  "papers": []
}
```

每个 paper 保留旧字段 `id,title,titleEn,authors,year,venue,tags,summary,whySelected,sources,demo`，并新增下列字段。`title` 为中文标题，`titleEn` 为原始英文标题；summary 为 **100–200 个 Unicode 字符**的中文导读，概括问题、方法、已核实结果，避免把未读实验猜成事实。`sources` 为 `[{"label":"原始论文","url":"https://…"}]`，原文为首项。

| 字段 | 类型 / 允许值 |
| --- | --- |
| profiles | 非空唯一数组，xun / li / lv；多类只存一篇 |
| recommendations | 与 profiles 一致的键；每项含 whyRead、relation（均非空字符串）、prerequisites（字符串数组）、difficulty（beginner/intermediate/advanced）、readRecommendation（skim/read/deep/save） |
| identity | `{doi: string或null, arxiv: string或null, other: string或null}`，至少一项有值；arxiv 不含 vN 版本，DOI 不含 URL 前缀 |
| publicationStatus | published / accepted / preprint / workshop / unknown |
| publicationDate | YYYY-MM-DD 或 null；不能凭发现日期推断发表日期 |
| discoveredDate | YYYY-MM-DD；不晚于日报日期 |
| verifiedAt | 核验到日 YYYY-MM-DD 或带时区的ISO时间戳；不捏造未提供的精确时间 |
| readDepth | metadata / abstract / fulltext，真实反映读过的层级 |
| paperType | theory / system / empirical / survey / benchmark |
| classic | 布尔；周一李、驴经典各最多一篇，独立于新文额度 |
| novelty | recent / older-discovery / major-update；旧文首期收录必须为 older-discovery；recent 指距日报不超过 30 天的已知发表日期 |
| updateNote | 字符串；major-update 必填实质变化，普通记录为空字符串 |
| links | `{code:null或URL, project:null或URL, video:null或URL, data:null或URL}`，仅核验存在的资源 |
| limits / assumptions | 字符串数组；不清楚时如实说明，不能编造 |
| evidence | 非空 `[{url:HTTP(S), claim:非空文本, checkedAt:核验日期或带时区时间戳}]`；为状态、结论或资源提供出处，每个非空资源URL均需有证据 |
| researchNotes | 字符串数组；完整保留重点核读范围、原始难度/阅读计划、修订日期、未运行代码等核验细节 |
| summaryEn | 必填，同一中文导读的忠实英文翻译（40–5000字符），不是原始摘要 |
| visuals | 必填，主图、论文署名机构、作者肖像与全部来源/版权记录；见 [素材契约](CARD-ASSETS.md) |

`whySelected` 是公共入选理由；各类别差异写在 recommendations，不把同一论文复制成不同 ID。理论型李论文需说明定义、定理/证明适用范围；系统型说明输入输出、算法和实验条件，可写在导读/limits/assumptions/推荐语中。

ID 应稳定，推荐 `arxiv-2601-01234` 或 `doi-` 加规范 DOI 的 SHA256 前20位。导入器会按 DOI / arXiv base / other 别名寻找既有 ID，预印本转正式版仍沿用原 ID。不要自己为同一论文制造第二个 ID；重大版本再次推荐保留 ID，填 major-update 与 updateNote。零域本机书签继续按稳定 ID 保存。

覆盖报告只列实际检查的入口。来源目录包含70项并不表示当天全部检查。短缺可为0；禁止用演示、无关论文或已读种子凑数量。首期旧文必须清楚标记“较早论文 · 首次发现”。

执行 `node scripts/ingest.mjs normalized.json` 后执行 `npm run check`。加 `--plan` 只输出3文件变更计划、不修改资料。原子GitHub树/提交/带expected_sha分支更新与Pages核验步骤见仓库README。外部流程负责检索与北京时间08:00调度，工程代码不创建重复自动任务。

## 驴的前沿／基础双线指导（未来日报）

驴沿用现有 v2 字段；P0/P1/P2 排序、具体阅读任务与诚实核读要求见 [驴的研究交接规范](LV-READING-GUIDE.md)。这些是未来研究交接的内容要求，不新增必填schema字段、不要求回填历史。迅与李的接口和规则不变。
