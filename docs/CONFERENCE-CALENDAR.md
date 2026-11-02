# 三方向科研日历：每日发布契约

公开数据：`data/conference-calendar.json`；校验：`lib/research-calendar.js`、`scripts/validate.mjs`。读取 `config/source-registry.json` 与 `config/profile-watchlists.json`，复用 `profileSources` 解析各方向 conference 来源：迅14、李11、驴10。公开JSON根 `profileSources` 用各方向准确会议名称数组绑定范围；共享事件只存一份，渲染按方向过滤，不把李的独立来源并入迅。来源变化时映射与覆盖集合必须同步。

## 每日官方核验

现有每日任务按北京时间08:00运行，核验官网再更新公开数据；即使当日无新论文，也可独立更新会议资料并经过同一原子提交、构建与部署流程。自动任务可能失败或官网暂不可访问，不承诺所有会议每天发布新公告。

- 根对象 `version:1`、`checkedAt:YYYY-MM-DD`、`coverage`、`events`。`checkedAt` 是此轮核验日，不得仅因重新构建刷新时间。
- `coverage` 三方向会议并集的每个来源恰有一项：`sourceId` 为 registry 的准确会议名称（沿用初版名称键，不是另造ID）、`edition`、`status`（verified/unpublished/conflict/unavailable）、`checkedAt`、`sourceUrls` 官方证据数组及 `note`。不能访问时明确 unavailable，保留最后有效事件和原 `verifiedAt`，不伪造新核验。
- 事件保持稳定 `id`，更正日期不生成重复节点。字段：`sourceId`、`conference`、`name`、`type`（conference/submission）、`startDate`、`endDate`（含末日）、`precision`（date/instant）、`timeZone`、`deadlineAt`、`sourceUrl`、`verifiedAt`、`place`、`track`、可选 `deadlineKind/note/timeZoneLabel`。
- `place` 为 `{city,country,venue,sourceUrl}`；未知地名用 null，不猜场馆。地点来源和日期来源可不同；城市、国家均未确认时界面显示待核实。
- `track` 必须是 main/workshop/journal-transfer/conditional/supplementary/camera-ready。名称清楚区分登记、全文、扩展摘要、工作坊提案、期刊转投。默认近期仅 main；「全部类型」展示其他类型。RSS阶段二仅受邀，不写成所有人的下一次投稿。
- 仅日期公告使用 `precision:date`、`deadlineAt:null`；未知时区使用 null，不能伪造23:59。精确截止须有带偏移ISO时间、官方时区（AoE使用 Etc/GMT+12，偏移-12:00），并与当地日期一致。界面同时给出北京时间；日期级倒计时只是估计。
- 冲突、未公布日期不加入倒计时；一个来源的会议日期冲突不否定其另有确证的独立投稿截止（例如IROS）。保留来源级解释，避免错误地统一成一个日期。
- 全部过期节点从近期倒计时排除，历史月份仍可查看。不要为了凑数新增未经核实日期。

发布前运行 `npm run check`，仅更新相关公开数据／必要说明；保留论文历史、ID、研究规则及各方向设计。原子 expected-SHA 提交后验证对应 SHA 的 Pages 成功和线上数据。任何无法确认的冲突或失败记录原因，保留最后有效资料。

## 客户端与私人事项

浏览器按北京时间显示今日，可见时每分钟重算；跨日、聚焦、恢复可见时以 no-cache 重新获取本站已发布JSON（60秒节流），校验失败不替换旧数据。浏览器刷新不能代替每日官网核查；不会触碰正在编辑的草稿或私人事项。

私人事项按方向隔离：迅原 namespace `paper-signal-calendar-tasks-v1` 与不带profile的旧v1备份完全保留；李/驴分别使用后缀 `-li` / `-lv`，备份显式带对应 `profile`。独立备份 format仍为 `paper-signal-calendar-tasks` version1。跨方向备份拒绝导入，不自动复制或迁移；切换方向只恢复本方向草稿。最多1000条、每条2000字符、总1MiB，严格验证日期／ID／字段，纯文本转义；合并导入保留本机冲突内容。写前检查其他标签页变化，冲突停止覆盖（localStorage不是事务数据库，非多端同步）。存储失败保留草稿并支持导出。私人事项、原始备份、个人内容绝不可进入仓库、每日任务、网络请求或日志。无提醒、推送、账号服务；原论文笔记和书签格式保持不变。

## 简洁界面约定

三个方向页面均不展示核验覆盖、待确认审计列表、逐条核验日期或冗长补充说明；这些证据完整保留在公开JSON供每日核查。后续资料更新不得把审计说明重新插回页面。界面只保留事项名称/类型、日期与时区、地点、官方链接、必要状态和操作；私人事项保留简短本机隐私提示与保存错误。地区列表直接显示在内部滚动区域，不设展开收起开关；三个方向采用相同固定布局、地区内部滚动，保留各自蓝／红／黑配色与背景。论文自身的导读、限制和研究证据不属于此次页面说明精简。
