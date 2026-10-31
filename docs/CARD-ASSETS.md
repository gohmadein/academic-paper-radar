# 双语论文卡片与素材契约

日报v2新增必填字段 `summaryEn` 与 `visuals`。`summaryEn` 是同一条100–200字符中文导读的忠实英文翻译，不是另贴原始摘要，也不能增加未经核验的结果。中文标题在上，原始英文标题在下；两种导读始终同时展示。论文ID、日期、选择规则与本机收藏格式不变。

```json
{
  "summaryEn": "A faithful English translation of the Chinese guide...",
  "visuals": {
    "mainFigure": null,
    "figureNote": "没有可核实主图时，填写真实原因。",
    "institutions": [],
    "authors": []
  }
}
```

## 本地素材对象

下列字段全部必填，仅在素材真实核验并允许相应展示时才引用。无法满足时用null，不猜链接、照片或许可。

| 字段 | 说明 |
| --- | --- |
| kind | figure / institution-logo / author-portrait，不能用机构图标充当人像 |
| path | `assets/papers/`、`assets/institutions/` 或 `assets/authors/` 下的安全相对路径，PNG/JPEG/WebP/SVG；不含..或远程地址 |
| sha256 | 最终打包字节的64位小写SHA256，不是原始大图的哈希 |
| width / height | 最终图像真实尺寸，正整数；SVG保留正确视图比例 |
| sourceUrl | 实际原始图像/材料来源；页面运行时不从此地址加载图片 |
| evidenceUrl | 能证明素材、作者身份或所属论文的官方原始页面 |
| verifiedAt | 真实核验日期或带时区时间戳，不捏造精度 |
| credit | 简洁图注/归属，随图展示 |
| rights | 如实保留许可、商标、版权或未核实的边界；arXiv非独占发布许可不是通用再利用许可 |
| displayPolicy | open-license / official-brand / attributed-thumbnail；这些是展示记录，不能将未知许可写成开放许可 |
| background | light / dark / transparent；白色标志可用compact dark backing，整体仍保持浅色主题 |
| altZh / altEn | 忠实的替代文字，不捏造图中结论 |

主图只使用论文/作者项目的实际主图或概览图，保持内容与比例；优化尺寸不能裁掉关键图例。理论论文没有主图时显示“暂无可核实主图”，不能生成假图。不要为当前空位从无关论文借图。

## 论文署名机构

`institutions` 的每项为 `{name, logo, authorNames, evidence, note}`。`logo` 为素材对象或null；`authorNames` 仅列论文实际作者，不能根据现雇主猜所属关系。`evidence` 为 `[{url,claim,checkedAt}]`，指向本篇论文或作者明确署名来源。`note` 说明署名/展示限制。未核验机构不填入，缺少可展示logo时以名字和明确的“文字标识”占位。

ASU等有外部许可限制的标志，以及许可未核实且要求保守展示的标志，应保持logo=null。受限文件不得放进部署资产目录；来源审阅包留在仓库之外。机构标志不是合作背书，不增加认证勾。

## 作者肖像

`authors` 的每项为 `{name,portrait,note}`，`name` 必须精确对应原始作者名单。`portrait` 为真实人像素材或null，来源必须明确把该照片标为这个作者；同校、同组或相似姓名不构成证明。没有官方可靠肖像时，可不填该作者的素材记录，界面自动显示中性姓名首字母与完整姓名。

完整作者名单始终可访问；卡片先展示部分作者并可展开其余作者。头像不是机构logo，不使用假人脸或AI生成肖像。

## 打包、校验与云端发布

先把审核后的字节放入 `path`，再导入规范日报。`npm run check` 校验本地存在性、SHA256与尺寸；SVG拒绝脚本、动态元素和未打包外部依赖。构建只拷贝被日报引用且通过校验的研究素材，另保留站点Logo和字体，不会整包发布来源审阅档案。

`node scripts/ingest.mjs normalized.json --plan` 继续返回3个JSON文件的 `files`，另外返回 `assetFiles`（path、encoding=base64、content、sha256）。云端可逐个用GitHub `create_blob` 的base64编码建立二进制blob，再将返回SHA与3个JSON文件一起加入一次 `create_tree` / `create_commit` / 带expected_sha的分支更新。不要把base64当UTF-8图像文件提交，也不要先发布引用缺失文件的日报。

图片以带内容版本的同源URL加载，主图object-fit:contain、声明尺寸并保留固定显示框。加载失败回退到同尺寸提示，避免版式跳动。卡片分享仅包含公开论文定位，不含本机收藏或已读列表；优先系统分享，再复制链接，权限不可用时提供可手动复制的文本。没有点赞、浏览量或认证计数。

外部每日调度沿用原计划；搜集流程需为新记录提供英文翻译、真实素材及证据，缺失情况如实说明。此工程不创建第二个调度或后端。
