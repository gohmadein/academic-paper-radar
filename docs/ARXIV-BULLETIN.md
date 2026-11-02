# 迅每日 arXiv 更新（独立于3–5篇精选）

## 分层与范围

未来迅精选3–5篇；优先机器人相关、经官方核实的Best Paper获奖、Oral、Spotlight与优质期刊文章。候选／入围不是获奖，workshop与主会奖项须区别。用会议官方获奖名单／程序表／论文集、明确的官方OpenReview决定或出版社页作证据，记录原始名称、会议年／track、URL、核验日。作者自报不能替代官方核验；标签不能替代相关性、质量、实际阅读与结果边界。原 `data/days/` 历史和李／驴额度不变。

简报另存 `data/arxiv/index.json` 和 `data/arxiv/days/YYYY-MM-DD.json`，不占精选名额、不写入精选身份注册表，也不修改书签／笔记／私人事项。相同arXiv论文可以同时在简报和精选出现，必须共享base-ID身份。简报只要求真实标题、完整作者、日期、分类、版本及官方链接，不要求长摘要、图片或虚构中文译名。论文均明确标为预印本，不宣称全文审读或质量推荐。

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

仅迅真实feed标题区之后显示独立折叠模块；不参与日历/地图对齐布局。长列表内部滚动，归档日期选择不修改论文筛选和URL。原文链接直达arXiv；“完整”只指公告范围/元数据筛查，必要覆盖状态保留。李／驴、来源／书签／档案／演示不显示。资源读取失败保持诚实不可用提示或上次有效资料，不伪造新日期。
