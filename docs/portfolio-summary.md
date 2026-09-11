# Portfolio card: Vehicle & Parking Info

Material for the project card on the personal website. Two blocks, English and Chinese, each with a blurb, tech tags and three highlights. The company is not named; the public demo uses a synthetic fleet, redacts identifying fields and marks unavailable features explicitly.

---

## English

### Blurb (about 150 words)

An internal fleet-administration workspace built inside a utility company's Feishu tenant for its transport team. Before it, vehicle changes arrived by email, were typed into a Bitable draft table, then re-typed into the Excel master so a macro could produce the logbook. The app gives staff a plate or parking-site lookup with floor plans, a request cart whose form adapts to the change type, and an admin console that approves requests, writes the new value back to the fleet record on its effective date with a read-back check, copies logbook rows to Excel in the macro's column order, and tracks offline follow-ups. One registry of change types, guarded by module-load invariants, decides what every approval does. Built on Feishu Spark with React, TypeScript, NestJS and PostgreSQL; the public demo runs the same client on a synthetic fleet with an in-browser backend, redacts identifying fields behind explicit bars, and states plainly what is unavailable.

### Tech tags

React 19 · TypeScript · Vite · Tailwind CSS · shadcn/ui · NestJS · PostgreSQL · Drizzle · Feishu Bitable · Feishu Spark

### Highlights

- A change-type registry with two booleans (writes the logbook? writes the fleet record?) and load-time invariants, replacing five scattered copies of the same rules across client and server.
- Approval as a transaction: logbook row, effective-date-gated write-back, read-back verification, plate-based record-id re-resolution, and a status bar plus drawer for changes whose date has arrived but are not yet written.
- An after-approval workspace that meets the team where it is: six-column TSV copy in the Excel macro's order, test-row marking during rollout, and a follow-up queue for approved requests that need offline action.

---

## 中文

### 简介（约 160 字）

一个建在公用事业公司飞书租户内部、服务运输团队的车队管理工作台。此前车辆变更靠邮件提出，先录入多维表格草稿表，再誊到 Excel 主表让宏生成 Logbook。应用提供按车牌或停车场的查询（含平面图）、随变更类型自适应的申请购物车，以及管理员控制台：审批申请、在生效日把新值写回车辆档案并读回校验、按宏要求的列序把 Logbook 行复制进 Excel、追踪线下跟进事项。一份带加载期不变式的变更类型注册表决定每次批准做什么。基于飞书妙搭，用 React、TypeScript、NestJS 和 PostgreSQL 实现；公开 demo 用同一套前端跑在合成车队和浏览器内后端上，身份类字段以明确的遮蔽条呈现，不可用的功能直接说明。

### 技术标签

React 19 · TypeScript · Vite · Tailwind CSS · shadcn/ui · NestJS · PostgreSQL · Drizzle · 飞书多维表格 · 飞书妙搭

### 亮点

- 变更类型注册表用两个布尔（进不进 Logbook、写不写车辆档案）加加载期不变式，取代了前后端五处散落的同一套规则。
- 批准是一个事务：Logbook 行、按生效日分流的写回、读回校验、按车牌重解析 record id，以及针对已到期未写回变更的状态条和执行抽屉。
- After Approval 工作区迁就团队现有流程：按 Excel 宏列序复制六列 TSV、灰度期标出测试行、为需线下处理的已批准申请提供跟进队列。
