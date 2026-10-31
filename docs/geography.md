# 推送世界地图 · 地理元数据

`data/paper-geography.json` 是独立、可选的已核验地理库，版本为 `1`。`npm run validate` 校验地点、经纬度、证据 URL 和论文引用。既有日报 schema 不变；旧资料库缺少本文件时仍可导入。

- `locations`：以稳定地点 ID 为键；每条含 `id`、`institutionId`、`label`、`city`、`countryCode`（两位）、`countryLabel`、`lat`、`lon`、`coordinatePrecision: "representative-city"` 和非空 `evidenceUrls`。坐标为城市级示意锚点，不是作者行踪或实验精确位置。可附中文标签、核验日期和 caveat。
- `papers`：以规范稳定论文 ID 为键；每条含去重 `locationIds`、`unresolvedInstitutionIds` 和非空 `evidenceUrls`。多地合作可有多个地点；全球篇数仍按论文 ID 去重。
- `unresolvedInstitutions`：按机构 ID 记录未能确认的地理位置。不得用跨国公司总部、作者国籍、项目头衔所在地补位。
- `coverage`、`currentPushDate` 等额外记录是首次人工核验快照，不是实时计数或“今日”的来源；地图实时使用当前资料及北京时间日期。

## 每日自动导入

`npm run ingest -- normalized.json --plan` 会复用地理库：新论文的 `visuals.institutions[].institutionId` 必须恰好匹配一个已核验地点，同时这篇论文的机构署名必须自带 `evidence[].url`。多校区匹配、未知机构、缺证据或 `unresolvedInstitutions` 中的机构不会被自动定位。已核验旧论文的映射默认不覆盖。新增机构先由研究人员核验并补充地点，不能从 logo、名称字符串、搜索排名或公司总部推断。

策展者可在导入输入的一篇论文上提供以下**仅导入时使用**的字段，显式确认或纠正其地点：

```json
"verifiedGeography": {
  "locationIds": ["illinois", "tsinghua"],
  "evidenceUrls": ["https://arxiv.org/html/2610.31841"]
}
```

地点 ID 必须已存在于核验库，证据必须支持该论文的署名地点。空 `locationIds` 配合证据可显式撤回定位。字段会从最终日报移除，信息保存在地理库；同一论文的重复输入如含矛盾地理数据则拒绝。没有地理库时不能提交此字段。没有此字段也不影响普通日报导入。

有变更时，导入计划额外包含 `data/paper-geography.json`，与日报、索引、身份及机构库一起暂存、校验、原子提交或回滚；无变化时不重写地理库。发布方必须上传计划内所有文件，不应假定文件数固定。地图未知计数保留未定位论文；所有论文仍可在原阅读列表浏览。
