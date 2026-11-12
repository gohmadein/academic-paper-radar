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

驴沿用现有 v2 字段；P0/P1/P2 排序、具体阅读任务与诚实核读要求见 [驴的研究交接规范](LV-READING-GUIDE.md)。这些是未来研究交接的内容要求，不新增必填schema字段、不要求回填历史。这份驴规范不改迅与李的接口；迅后续精选规则见下文。

### 迅未来精选资格（2026-11-06起）

迅维持5篇（3会议＋2期刊）目标，会议与期刊名额固定为3篇和2篇，不互相替代，宁缺毋滥。先近期未推荐的正式会议/期刊，后标明较早补漏；机器人学习与具身智能优先，其他机器人相关方向仍可选。Best Paper/Oral/Spotlight身份必须有官方证据。仅预印本统一进入独立arXiv模块，不纳入迅精选；正式版本可保留arXiv原文链接。导入器从生效日起拒绝迅的preprint/unknown状态，只接受accepted/published，仍须研究方核实正式会议/期刊出处与证据；workshop不计入本次正式会议名额。历史日期与李/驴不受此门槛影响。

自2026-11-06新一期起，迅每日固定名额为3篇正式会议论文、2篇正式期刊论文。缺一类不得用另一类补位，质量不足或核验未完成须报告缺口，不凑数。每篇新增 `formalPublication: {type: "conference" 或 "journal", evidenceUrl: "官方证据URL"}`，证据URL须对应同篇 `evidence` 的正式录用/出版证明，不能只指向arXiv。不足时在 `coverage.limitations` 写明 `迅精选不足：会议 X/3，期刊 Y/2；具体原因`，X/Y须与实际数量一致。导入和全量发布校验均执行此约束。历史日报不追改，李/驴及独立arXiv公告保持不变；正式论文的arXiv全文链接保留。


### 李的近期数据库拓展补充（2026-11-12起）

先按李的既有VKG/OBDA实例更新、视图更新/双向变换、provenance/lineage/causality、约束修复及相关理论筛选。原方向近期、未推荐且达到质量与核验要求的候选不足时，主动补查近期数据库方向有影响力论文，使用`config/digest-rules.json`的`profiles.li.databaseFallback`，不局限于与原方向直接匹配的论文。优先30天近期窗口，再按真实发表/录用日期向更早日期查漏；较早首次发现标记`older-discovery`，不冒充新稿。

拓展项仍使用现有v2字段，不新增必填schema字段、不追改历史：

- `recommendations.li.whyRead`：明确标记“数据库拓展阅读”，说明核心贡献、推荐价值与可核验影响力依据。
- `recommendations.li.relation`：说明与原研究方向的直接或间接联系及可借鉴之处；没有直接联系就如实说明，不牵强套用VKG更新框架，不把直接相关性重新设为拓展项硬门槛。
- `evidence`：记录状态、真实发表日期、影响力事实及资源的原始URL与核验日期。影响力可以由官方奖项/重要论文认定、有来源和查询日期的引用/采用证据或可核验的重要方法/系统贡献支持；venue、名校、作者名气或热度本身不足以证明高影响力。证据不足须说明，禁止编造引用量、奖项或采用情况。
- `researchNotes`：记录原方向候选不足、补充理由、实际阅读范围与未核验项。原方向更新框架不适用的项目写不适用，不捏造更新语义或实验。

原方向优先，补充项只补不足，不挤掉已合格原方向论文；合计仍为李每日1–3篇，质量或核验证据不足允许少推或0篇，不新增独立配额。周一额外经典独立规则保持不变，不能以经典、已读种子或已推工作冒充近期新发现。完整作者、出版状态、双语导读、局限、资源、署名/机构/素材核验、身份去重与发布校验均保持。迅与驴的规则、配额、来源及现有调度不变。
