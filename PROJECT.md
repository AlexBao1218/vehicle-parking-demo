# Vehicle & Parking Info Demo — 项目手册

两部分。第一部分给 Alex 看，讲这个东西在哪、怎么预览、怎么放进个人网站。
第二部分给 AI 看，讲架构、规则和不能碰的东西。改代码前两部分都读。

---

## Part 1 · 给 Alex

### 这是什么

在公司用飞书妙搭（Spark）做的车辆与停车位信息系统（查车、申请变更、管理员审批、写回 Fleet List、导出 Logbook）的公开作品集版本。前端页面原样保留，飞书运行时和 NestJS 后端各用一个浏览器内的替身替掉，数据全部合成，身份/财务类字段遮蔽。

### 在哪

| 位置 | 地址 |
|---|---|
| 本地 | `~/Desktop/vehicle-parking-demo` |
| GitHub | https://github.com/AlexBao1218/vehicle-parking-demo（目前 **private**，确认没问题后再改 public） |
| 线上 | 还没部署，见下面"部署" |
| 原始导出包 | `~/Downloads/vehicle info.zip`（含真实 Base token、表 ID、测试车牌，不要上传到任何地方） |

### 先做这件事：原导出包里的凭证

导出包 `server/capabilities/*.json` 里有两个 Base 的 appToken、五个 tableID 和创建者 user id；`.env` 里有测试车辆车牌白名单。这些不是密码，但等同于租户标识，按泄露处理：在飞书后台确认这些 Base 的分享范围，如果已离职就不用管。本仓库没有拷贝任何一个。

### 本地预览

```bash
cd ~/Desktop/vehicle-parking-demo && npm run dev
```

打开 http://localhost:4180。四个页面：`/`（Search，按车牌 / 按停车场两个 Tab）、`/apply`（New Request）、`/admin`（Approvals，`?tab=after-approval` 是第二个 Tab，右上历史图标是 Archive 抽屉）、`/approval-history`（My Requests，导航里没有入口，直接输 URL）。

演示数据存在浏览器 localStorage，导航栏右端的 **Reset data** 一键还原。首次打开默认已查好 `DEMO 101`；搜索时输入 `DEMO` 或任意数字即可出候选。

生产构建检查：

```bash
cd ~/Desktop/vehicle-parking-demo && npm run typecheck && npm run lint && npm run build
```

### 披露级别（我替你选的，可以改）

SOP 里的三档：① 合成聚合 + 记录级遮蔽 ② 通用占位符 ③ 只留结构。这个系统是查询 + 审批流，没有图表和金额，全遮蔽的话搜索和审批都演示不了，所以选了 **②：通用占位符 + 合成记录，身份/财务字段遮蔽**：

- 车牌 `DEMO 101`–`DEMO 136`，停车场 `Parking Site 01`–`10`，部门 `Department A`–`F`，人员 `Coordinator 1`–`6`，公司 `Company A/B`
- 车型用常见车队车型（Toyota Hiace、Isuzu NPR 等），随机分配，不对应任何真实车辆
- 底盘号、发动机号、登记日期、牌费、购置价、成本中心、GPS 供应商、地址、平面图、街景 → 灰条 "Redacted for public demo"
- 真实系统里的车辆总数、停车场数、Fleet List 列数、用户数一律不出现

想换成 ③ 只改 `client/src/data/demo-dataset.ts`。

### 发布

已推到 private 仓库。自己过一遍后改 public：

```bash
cd ~/Desktop/vehicle-parking-demo && gh repo edit --visibility public --accept-visibility-change-consequences
```

### 部署到 Vercel

这台机器的 Vercel CLI 没有登录，所以我没有部署。步骤：

```bash
cd ~/Desktop/vehicle-parking-demo && vercel login
```

```bash
cd ~/Desktop/vehicle-parking-demo && vercel --prod
```

第一次会问项目名，用 `vehicle-parking-demo`。`vercel.json` 已经配好 SPA 重写。部署完在 Vercel 项目的 Domains 里加 `fleet-demo.zijun.cloud`，然后到 DNSPod 给 `zijun.cloud` 加一条 CNAME：`fleet-demo` → `cname.vercel-dns.com`。

### 放进 zijun.cloud

1. 在 `content/projects/_index/en.json` 和 `zh.json` 的 `projects` 数组加一条，slug 用 `vehicle-parking`（`lib/brand.ts` 的 `CASE_STUDY_URL` 指向 `https://zijun.cloud/en/projects/vehicle-parking`，slug 不要改）。
2. 新建 `content/projects/vehicle-parking/en.json` 和 `zh.json`。素材直接取：
   - 卡片文案、标签、亮点：本仓库 `docs/portfolio-summary.md`
   - 正文各节：`docs/case-study.md`（英文）和 `docs/zh/case-study.md`（中文）
   - 架构图和数据模型：`docs/architecture.mmd`、`docs/data-model.mmd`
3. `meta.url` 填 demo 线上地址，`urlLabel` 写 "Open demo"。
4. 截图：README 里有占位段落，部署后截 Search、Admin Approvals、After Approval、Request Archive 各一张。

case study 里有几处 `[TO FILL]`（车队规模、使用人数、每月申请量、节省时间），发布前填掉或删掉。

### 还没做的事

- GitHub 仓库切 public
- Vercel 部署和子域名
- zijun.cloud 项目页
- README 截图

---

## Part 2 · For AI agents

Read this before touching any file. The rules in "Disclosure policy" are not negotiable and were set by the owner for confidentiality reasons.

### Purpose

Public portfolio demo of an internal fleet-administration app the owner built on Feishu Spark (妙搭). The goal is to show the system's design, workflow and engineering decisions, not its data. Anything that would identify the employer, its sites, its people or real figures is withheld.

### Disclosure policy (hard rules)

1. **No company name, real or fictional.** The product is `PROGRAM_NAME` = "Vehicle & Parking Info". Never invent a stand-in company, site name, vendor or person. Placeholders are letters and numbers (`Department B`, `Coordinator 4`, `Parking Site 03`).
2. **Withhold, don't substitute.** A withheld value is the `REDACTED` sentinel in `client/src/data/demo-dataset.ts` and renders as the `<Redacted />` bar (`client/src/components/Redacted.tsx`), never as a made-up value, never as a dash.
3. **What is withheld:** chassis / engine / approval numbers, fleet numbers, registration and expiry dates, sold dates, purchase prices, licence fees, cost centres, vendors and camera models, replacement plans, free-text remarks copied from the source, site addresses, floor plans, street photos, attachment files.
4. **What may show:** synthetic plates and site labels, placeholder org fields, common vehicle makes/models, status values, fuel and class categories, Bitable option values (`有限高` etc. mapped to English), the workflow itself with synthetic dates.
5. **No real magnitudes.** Never write the real fleet size, number of sites, number of fleet-list columns, request volumes or user counts anywhere in code, comments or docs. `[TO FILL]` in the case study is for the owner.
6. **Platform-only features say so.** File upload shows `NOT_AVAILABLE_LABEL`. Do not add a fake storage layer for attachments.
7. **Never reintroduce** the employer's abbreviation (it used to be part of a field name; now `Veh. Class`), Base app tokens, table ids, plugin `createdBy` ids, the real test plate, or the platform's favicon/branding. Run the leak scan below before every commit.

### Architecture

Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui. Static SPA, no server.

```
client/src/
  platform/index.tsx      shim replacing @lark-apaas/client-toolkit: logger, capabilityClient
                          (fleet + parking tables over the synthetic dataset), demo user,
                          scopedStorage, UniversalLink, AppContainer (TooltipProvider + Toaster),
                          axiosForBackend → backend.ts
  platform/backend.ts     every /api route; mirrors reference/server/modules/** rules
  platform/seed.ts        seeded requests in every status + logbook rows (relative dates)
  platform/store.ts       localStorage persistence (key vpi-demo:store), resetDemoData()
  data/demo-dataset.ts    36 vehicles, 10 sites, placeholder SVG images, REDACTED fields
  lib/brand.ts            PROGRAM_NAME, REDACTED, NOT_AVAILABLE_LABEL, CASE_STUDY_URL
  components/             Layout (Header), Header (nav + Reset data), Redacted, ui/
  pages/                  original page code; only edits: brand name, attachment notice,
                          Sensitive rendering, cleaned extra-field keys
shared/                   api.interface.ts, change-types.ts (the registry), format-logbook-date.ts
reference/server/         original NestJS modules; documentation only, excluded from tsconfig/eslint
docs/                     case study EN/ZH, mermaid diagrams, portfolio blurb, engineering notes
```

Vite and tsconfig alias `@lark-apaas/client-toolkit*` to the shim, so page code still imports the original names.

### Commands

```bash
npm run dev        # http://localhost:4180
npm run typecheck  # tsc, must be clean
npm run lint       # eslint, 0 errors (5 warnings inherited from the original pages)
npm run build      # vite build → dist/
```

Leak scan (must print nothing; the word list lives outside the repo in the owner's notes — the patterns below are the public-safe subset):

```bash
grep -rniE "towngas|hkcg|PB159|JEB5bKynUa2|KWUObzdj3a|tbl[A-Za-z0-9]{12,}|7654116046898629831|sharepoint" client/src shared docs reference README.md PROJECT.md dist
```

(Platform names — Feishu, Spark, 妙搭, `@lark-apaas/*` — are fine; they describe the stack, not the employer.)

### Conventions

- Keep page code diff-minimal against the original; put demo behaviour in `platform/` and `data/`.
- Stored contract values stay Chinese (`草稿` / `待审批` / `已批准` / `已拒絕`, `有限高`…); only `data/labels.ts` maps them for display.
- Change-type behaviour is decided by `shared/change-types.ts` (writesLogbook / syncsVehicleField); never hard-code type ids in pages or backend.
- Dates in the seed are relative to seed time so "effective today" and "pending sync" states hold on any day.
- English UI copy. The owner reviews visually; when in doubt take a screenshot at 1440×900 and 375px.

### Verification before claiming done

1. typecheck, lint, build all clean.
2. Leak scan empty.
3. Browser pass: `/` (both tabs, one vehicle with Full Details open, one site with images + lightbox), `/apply` (add draft, edit, submit), `/admin` (approve one, reject one, edit one; After Approval copy TSV + mark complete; sync drawer execute; archive filters), `/approval-history`, at desktop and 375px, no console errors on a fresh load.
4. Every withheld field shows the bar, never `[redacted]` text or a dash.

### Where the history lives

- `docs/case-study.md` — context, architecture, data model, decisions, incidents, outcomes (has `[TO FILL]` placeholders).
- `docs/engineering-notes.md` — scrubbed incident log from the original build.
- `reference/server/` — the real approval / draft / parking services, for readers who want the backend logic.
- Git log — every disclosure decision is a separate commit with the reasoning in the message.
