# 驴的研究交接：前沿理解 + 基础补齐

仅适用于未来含 `lv` 的推荐语；其他方向与历史日报不改。权威研究排序在 `config/digest-rules.json` 的 `profiles.lv`；公开配置只记录通用研究偏好，不放私人履历、账号信息或本机笔记。

## 优先级与数量

- **P0**：Robot Learning / Manipulation，IL、BC、RL、Diffusion Policy、Visuomotor Policy。
- **P1**：Robot Perception / CV for Robotics；3D、空间感知、深度、点云、6D位姿、检测分割、视觉表征、视觉操作。
- **P1**：Isaac Lab / MuJoCo、仿真、Sim2Real、合成数据、评估、环境设计。
- **P2**：VLA、基础模型、世界模型、跨形态、多模态具身学习。
- **P2**：人形、全身控制、灵巧操作。

优先级用于选择相关且有价值的论文，不是每日五类各占名额。普通推送仍为每日1–3篇，质量不足允许少于目标甚至0；周一可额外最多1篇基础经典，`classic=true`，不强行凑满。前沿线追踪研究进展；基础线解释读懂前沿所需概念，可体现在同一篇的阅读指导中，不制造每日额外配额。

CVPR/ICCV/ECCV仅筛选与机器人感知、操作、空间理解或具身任务直接相关的工作；NeurIPS/ICLR/ICML仅机器人学习相关；arXiv cs.LG/cs.CV仅机器人任务直接相关。排除无关纯CV/LLM，但**不因难度高、数学多或RL而排除**。基础指导不是把研究方向降为入门教程。

## 复用现有字段，不改变历史schema

| 内容 | 现有字段 | 写作与核验要求 |
| --- | --- | --- |
| 为什么值得读 | `recommendations.lv.whyRead` | 当前价值、优先级、推荐时机；不照抄摘要 |
| 问题—方法—结果 | `summary` / `summaryEn` | 中文100–200字与忠实英文翻译；只写证据支持的内容 |
| 结果边界 | `limits` / `assumptions` / `evidence` | 任务、数据、对照、限制；“作者报告”不写成“已独立验证” |
| 机器人任务关系 | `recommendations.lv.relation` | 具体关联研究线与机器人任务，不只堆标签 |
| 前置与概念缺口 | `recommendations.lv.prerequisites` | 列理解该论文需要的概念、建议补齐顺序；不推断用户知识状态 |
| 先读哪里 | `researchNotes` | 用“驴·阅读路线”条目给实际核验的章节、图、表及阅读顺序；交代前沿线／基础线；不要虚构图号、页码或阅读时长 |
| 难度与现在是否读 | `difficulty` / `readRecommendation`（均在 `recommendations.lv`） | 难度如实填 beginner/intermediate/advanced；read/deep=现在读，skim=先摘要／概览，save=稍后读，并在推荐语说明原因 |
| 实际核读 | `readDepth` / `researchNotes` | metadata/abstract/fulltext如实填写；正文重点核读不等于完整通读、逐式验证或复现 |

具体章节／图表尚未核验时不填猜测编号，在 `researchNotes` 明确“仅核读摘要，具体章节/图表未核验”；前置知识无法判断时现有数组可为空并说明不足。不能为满足指导项把 `readDepth` 夸大为 fulltext。资源未知仍为 `null`，可用原始来源已核验的入口；没有代码不自动排除有价值的研究。

已有 `researchNotes` 会在详情“阅读与核验记录”显示，无需另造页面或新增字段。双语题名/导读、论文真实插图及来源、资源证据、稳定ID、跨方向/跨日期去重、major-update规则均沿用既有接口。经典与旧文必须正确标注，不能为补基础重复当作新文推送。

## 发布前内容检查

逐篇检查“为什么—问题/方法/结果与边界—任务关联—前置缺口—具体阅读路径—阅读时机”，缺项如实说明。区分作者报告、当前阅读者核验、未运行复现。`npm run check` 负责结构、数据与交互回归，不代表研究结论已被独立验证。配置落地也不代表外部08:00调度提示词已经更新或下一期已执行；外部任务需独立核验。
