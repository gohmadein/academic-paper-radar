# 迅每日 arXiv 更新（独立于3–5篇精选）

## 分层与范围

未来迅精选3–5篇；优先机器人相关、经官方核实的Best Paper获奖、Oral、Spotlight与优质期刊文章。候选／入围不是获奖，workshop与主会奖项须区别。用会议官方获奖名单／程序表／论文集、明确的官方OpenReview决定或出版社页作证据，记录原始名称、会议年／track、URL、核验日。作者自报不能替代官方核验；标签不能替代相关性、质量、实际阅读与结果边界。原 `data/days/` 历史和李／驴额度不变。

简报另存 `data/arxiv/index.json` 和 `data/arxiv/days/YYYY-MM-DD.json`，不占精选名额、不写入精选身份注册表，也不修改书签／笔记／私人事项。相同arXiv论文只有在正式会议/期刊身份另经官方核实后才可同时进入未来精选，并共享base-ID身份；仅预印本留在本模块。当前完整公告卡字段与双语导读要求见下文，不编造信息。论文均明确标为预印本，不宣称全文审读或质量推荐。

六个官方分类：cs.RO、cs.CV、cs.LG、cs.AI、eess.SY、eess.IV；cs.SY是eess.SY别名，不重复抓取。逐项筛查所有分页中的标题和摘要，覆盖机器人全方向（操作、感知、控制、规划、HRI、自动驾驶、空中／水下／空间机器人及直接支持机器人任务的方法）。排除纯机械机构设计、与机器人无关的泛视觉／LLM；没有任意Top N。保留筛选理由和原始快照供审阅，疑难相关性须显式说明；完整覆盖表示完成元数据筛查，不等于结论独立验证。

## 官方公告批次，而非提交日

- 官方公告时刻：[availability](https://info.arxiv.org/help/availability.html)，美国东部周日–周四20:00，周五／周六不公告，节假日/延期以实际来源为准。用America/New_York处理夏令时，不硬编码全年UTC偏移。
- 北京08:00既有任务不变；冬令时通常早于当日09:00对应公告。若当日批次尚未出现，保留观察到的上一批次日期并报告待更新，不能称当天零新增。浏览器加载已发布站点JSON不是自行抓arXiv，也不承诺08:00获得尚未公告的数据。
- 六个 `/list/{category}/new` 页面或对应历史官方列表决定公告成员与new/revised/cross-list。API的published/updated是提交／版本日期，不等于公告日期。每日记录 `date` 是本站归档日，`announcementDate` 为核验的公告日期，`checkedAt` 为本次核验时刻；不得把旧批次改成新公告。
- [API文档](https://info.arxiv.org/help/api/user-manual.html)：完整分页并核对totalResults，默认只有10条；批量id_list补全版本、作者和提交/更新日期，遵守官方请求间隔／上限。[RSS文档](https://info.arxiv.org/help/rss.html)：RSS时序和上限可能不同，不能只凭一个feed返回就声称完整覆盖。

## 数据契约

`schema/arxiv-bulletin.schema.json` 与 `lib/arxiv-bulletin.js` 定义严格结构。

根：version=1、date、announcementDate（未知null）、checkedAt（日期或带时区ISO）、status（complete/partial/unavailable）、coverage、entries。

coverage：checkedCategories仅列实际筛过的规范分类；checkedCount为已筛过的分类记录数（交叉出现重复计算）、includedCount为base-ID去重后的机器人相关条数；limitations说明元数据筛选和访问限制；categoryStatus必须逐一覆盖六类，包含category、status、announcementDate、listedCount（未知null）、checkedCount、官方sourceUrl。只有六类同批次全分页核对并完成逐条筛查才用complete；partial说明遗漏，unavailable不能伪称0更新。

entry：id=`arxiv-`+baseID把点换横线；arxivId不带版本；version正整数或null；titleEn；titleZh可null；authors完整数组；publishedDate/updatedDate可null；change（new/revised/cross-list）；categories；url为对应官方abs URL（有确证可带vN）；topics；announcements保留各分类的真实公告类型。同批次每个baseID只一条，不同分类相同时合并，聚合类型优先new、其次revised、再cross-list。未知版本／日期不猜测；原始提交日期不能写为发现日。条目数不截断，版本更新单独标记。

## 导入、失败与发布

```sh
node scripts/arxiv-ingest.mjs verified-bulletin.json --plan
npm run ingest:arxiv -- verified-bulletin.json
npm run check
```

导入先验证、归一顺序，在临时目录验证索引后事务替换；同次重复输入幂等。保留所有历史日期；拒绝不完整刷新覆盖完整批次，拒绝同日刷新丢失已归档条目。失败保留最后有效资料，不把网络失败写成空成功。身份、版本或筛选需要更正时单独审阅明确差异，不能静默删除历史。

日报和简报可独立更新；存在已核验新公告时即使精选不足也可更新简报。用同一GitHub expected-SHA原子树提交，保持既有会议资料和私人数据边界；部署后验证精确SHA Pages终态和线上JSON/资源。不得创建第二个调度／后端，也不得向服务器传本机私有内容。

## 简洁界面

仅迅真实feed每日精选卡片之后、底部机构标识库之前显示独立折叠模块；不参与日历/地图对齐布局。长列表内部滚动，归档日期选择不修改论文筛选和URL。原文链接直达arXiv；“完整”只指公告范围/元数据筛查，必要覆盖状态保留。李／驴、来源／书签／档案／演示不显示。资源读取失败保持诚实不可用提示或上次有效资料，不伪造新日期。


## 双语导读与阅读功能（兼容旧档案）

每条新公告必须补齐 `guide`；历史无该字段仍可读取，但显示“中文导读待补齐”，不得把元数据完整冒充导读完成。本次2026-11-02档案142条一并补齐。`guide`字段：titleZh、summaryZh（100–200字符）、summaryEn（中文导读忠实英文翻译，不直接拿原摘要代替）、whyRead、relation、prerequisites数组、difficulty（beginner/intermediate/advanced）、readRecommendation（skim/read/deep/save）、tags数组、limits数组、assumptions数组、readingAdvice数组、links（code/project/video/data各为独立核验URL或null）、evidence（url/claim/checkedAt）。每项资源URL须有对应核验证据；至少包含本条官方arXiv摘要链接的证据。

按官方摘要撰写的导读必须标注摘要级阅读；结果归于作者报告，不能暗示独立复现、全文审读或具体章节/图表已核验。阅读建议可建议先读摘要或后续核对正文，但不能虚构章节。未知署名机构不推断，资源null表示未核验、不代表不存在。公告版本的状态明确为预印本，不凭记忆猜会议录用和奖项。guide证据保留自己的核验日期，不能假借补导读刷新六分类公告原始核验时间。

公告卡复用推荐卡的双语标题/导读、作者、阅读建议、详情、本机书签/已读/笔记与分享；仅省略主图及空主图占位；校徽/机构标识与精选使用相同核验标准。稳定base ID与精选共用，本地存储格式不变；同ID已在精选时书签集合优先既有精选记录，不生成重复收藏。公告档案加载用于跨日期收藏与分享详情查找，不进入精选数量、配额、地图或日报。长卡片仍在折叠模块内部滚动，切换阅读状态或导读展开保留滚动位置。

同日期导入不得将已有guide丢弃。未来流程按全部相关公告完成导读，不设Top-N；若导读尚未完成必须保留条目与明确待补状态，不能删条目、假称补齐或改写旧精选。

公告详情路由的可选 `bulletin=YYYY-MM-DD` 仅指定公告档案，不改变每日精选的 `date` 筛选；分享保留该日期。合并限相同稳定ID；不自动把不同 DOI-ID 与 arXiv-ID 的旧私人笔记迁移或合并，避免冲突和覆盖。公档加载失败不会删除本机ID。


## 论文署名机构与官方标识（2026-11-02修订）

arXiv不再豁免校徽。每篇须独立核对对应版本PDF/HTML署名页或明确指向该论文的作者项目页，不能从作者姓名、当前雇主、相邻论文或机构库猜单位。先确认论文署名，再按名称/别名复用 `data/institutions.json`，同机构同SHA不重复下载或存图。大学使用官方完整校徽或紧凑身份符号；研究机构/企业使用自身官方标志，不AI重绘、不用相似图代替。透明背景优先且检查实际alpha，清华既有官方白底例外保持原样；官方限制或无法核实的素材保留名称与原因，不伪造已解决状态。

entry新增可选且成对的 `affiliations` 与 `affiliationVerification`（旧档案仍兼容）。affiliations数组项：institutionId（库内稳定ID）、name（署名名称或已登记别名）、institutionType、authorNames（必须属于本论文完整作者名单，不能确认映射时留空并说明）、evidence数组(url/claim/checkedAt)、note。affiliationVerification包含status(complete/partial/unavailable)、checkedAt、note；unavailable必须空数组，complete必须有已核实机构。complete仅表示该篇署名单位核验完整，不表示每家机构都有可合法展示标识。

新机构先登记一次并审核图像/来源/使用条件。公告只保存ID和论文署名证据，不复制logo元数据；运行时从统一库解析真实标识，构建验证所有ID/名称/类型和资产SHA。补图时同步既有精选日报的机构快照，但不改变作者、摘要、论文ID、推荐类别、日期或私人状态。库、署名、被引用图像必须同一次原子发布；`ingest:arxiv`的暂存验证使用同一机构库。刷新不得静默移除已有已核实署名机构；事实更正须独立审阅差异。

## 迅精选来源与排序（自2026-11-04起）

机器人学习、具身智能优先，其他机器人方向仍可入选。先筛查近30日等日期接近的未推荐正式会议/期刊候选，再补较早首次发现并标注原日期。Best Paper/Oral/Spotlight须独立官方证据；会议:期刊约3:2为软目标，不按比例凑数，目标3–5但可不足或0。仅arXiv预印本不进入精选。已核实会议录用或正式发表的论文可用arXiv作为阅读链接，正式出处、状态和证据必须一致；workshop不得冒充主会。旧日报不追改。
