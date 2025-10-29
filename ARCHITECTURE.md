# 项目架构说明

本文档描述了 AutoBDK GUI 的模块化架构设计。

## 目录结构

```
src/
├── renderer.ts              # 主入口文件 (325 行)
├── types.ts                 # 共享类型定义
├── index.css                # 全局样式
├── api.ts                   # API 接口定义
├── main.ts                  # Electron 主进程
├── preload.ts               # Electron 预加载脚本
├── utils/                   # 工具函数
│   ├── date.ts             # 日期格式化工具
│   └── dom.ts              # DOM 操作工具
└── modules/                 # 功能模块
    ├── auth.ts             # 认证管理 (~110 行)
    ├── calendar.ts         # 日历管理 (~155 行)
    ├── webview.ts          # WebView 管理 (~80 行)
    ├── cookies.ts          # Cookie 管理 (~145 行)
    └── checkin/            # 一键打卡模块
        ├── index.ts        # 主逻辑 (~110 行)
        ├── analyzer.ts     # 考勤分析器 (~160 行)
        ├── ui.ts           # UI 渲染 (~290 行)
        └── executor.ts     # 补签执行器 (~95 行)
```

## 模块说明

### 1. 核心模块

#### `renderer.ts` - 主入口
**职责**: 应用初始化和模块协调
- 初始化所有管理器
- 设置事件监听器
- 协调各模块交互

**代码行数**: 325 行（原 1174 行，减少 72%）

---

### 2. 类型定义

#### `types.ts`
**职责**: 共享的 TypeScript 类型定义

**导出类型**:
- `UserInfo`: 用户信息
- `ApprovalItem`: 补签项
- `AttendanceClockType`: 打卡类型枚举
- `AttendanceSituation`: 考勤状态枚举

---

### 3. 工具模块 (`utils/`)

#### `date.ts`
**职责**: 日期和时间处理工具

**导出函数**:
- `parseTimestamp(timestamp)`: 解析 Unix 时间戳
- `formatDate(timestamp)`: 格式化为 MM-DD
- `formatTime(hour, minute)`: 格式化为 HH:mm
- `getAdjacentMonth(yearmo, offset)`: 计算相邻月份

---

#### `dom.ts`
**职责**: DOM 操作工具

**导出函数**:
- `escapeHtml(text)`: HTML 转义
- `toggleDropdown(dropdown, others)`: 切换下拉菜单
- `closeAllDropdowns(dropdowns)`: 关闭所有下拉菜单

---

### 4. 功能模块 (`modules/`)

#### `auth.ts` - 认证管理器
**职责**: 用户认证和会话管理

**核心方法**:
- `verifyCookies()`: 验证 Cookie 有效性
- `getUserInfo()`: 获取用户信息
- `getCsrf()`: 获取 CSRF Token
- `getYearmo()` / `setYearmo()`: 管理当前年月
- `updateTopBarDisplay()`: 更新顶部栏显示
- `updateDropdownDisplay()`: 更新下拉菜单显示
- `clear()`: 清空认证信息

**状态管理**:
- `currentUserInfo`: 当前用户信息
- `currentCsrf`: CSRF Token
- `currentYearmo`: 当前年月

---

#### `calendar.ts` - 日历管理器
**职责**: 日历的渲染和显示

**核心方法**:
- `render(data, onMonthChange)`: 渲染日历
- `showLoading()`: 显示加载状态
- `showError(message)`: 显示错误信息
- `clear()`: 清空日历

**特性**:
- 自动生成日历网格
- 显示农历
- 标记异常考勤
- 支持月份导航

---

#### `webview.ts` - WebView 管理器
**职责**: 管理登录 WebView 的生命周期

**核心方法**:
- `create()`: 创建并初始化 WebView
- `destroy()`: 销毁 WebView
- `getWebView()`: 获取 WebView 实例
- `isCreated()`: 检查是否已创建

**特性**:
- 自动设置移动端 UserAgent
- 启用设备模拟
- 监听 Cookie 变化
- 禁用右键菜单

---

#### `cookies.ts` - Cookie 管理器
**职责**: Cookie 的查看、删除和管理

**核心方法**:
- `renderCookieTree(cookies, container)`: 渲染 Cookie 树形结构
- `clearAll()`: 清空所有 Cookies
- `loadAll()`: 加载所有 Cookies

**特性**:
- 按域名分组显示
- 支持折叠/展开
- 单个 Cookie 删除
- 显示详细元数据

---

### 5. 一键打卡模块 (`modules/checkin/`)

#### `index.ts` - 主逻辑
**职责**: 协调整个一键打卡流程

**核心方法**:
- `start()`: 启动补签流程
- `executeCheckin()`: 执行补签
- `isRunning()`: 检查是否正在运行

**流程**:
1. 打开对话框并显示加载状态
2. 调用分析器分析考勤数据
3. 显示预览界面等待用户确认
4. 执行补签并显示进度
5. 显示最终结果

---

#### `analyzer.ts` - 考勤分析器
**职责**: 分析考勤数据，找出需要补签的记录

**核心方法**:
- `analyze()`: 分析考勤数据，返回补签项列表
- `analyzeRecord(record)`: 分析单条记录

**分析逻辑**:
1. 获取当月所有异常记录（`situation === -1`）
2. 对每条异常记录：
   - 获取详细打卡信息
   - 检查已有的补签记录
   - 判断上班/下班是否需要补签
3. 返回补签项列表

**常量**:
- `HOUR_START = 10`: 默认上班时间
- `HOUR_END = 19`: 默认下班时间

---

#### `ui.ts` - 对话框 UI
**职责**: 管理补签对话框的 UI 渲染和更新

**核心方法**:
- `show()` / `hide()`: 显示/隐藏对话框
- `setTitle(title)`: 设置标题
- `showLoading(message)`: 显示加载状态
- `showError(message, detail)`: 显示错误
- `showPreview(items, onConfirm, onCancel)`: 显示预览
- `showProgress(items)`: 显示进度
- `updateItem(index, item)`: 更新单个项状态
- `showResult(items, onClose, onRefresh)`: 显示结果

**UI 状态**:
- `loading`: 加载中
- `preview`: 预览待补签项
- `progress`: 补签进度
- `result`: 最终结果
- `error`: 错误提示

---

#### `executor.ts` - 补签执行器
**职责**: 执行补签流程

**核心方法**:
- `execute(items, onProgress)`: 执行补签
- `submitApproval(item, config)`: 提交单个补签申请

**执行流程**:
1. 获取补签配置（`newSignAgain`）
2. 遍历每个补签项：
   - 更新状态为 `processing`
   - 构造补签请求
   - 提交申请（支持重试）
   - 更新状态为 `success` 或 `error`
   - 等待 10 秒（避免请求过快）

**重试机制**:
- 最多重试 5 次
- 只对"重复提交"错误重试
- 其他错误直接失败

---

## 模块依赖关系

```
renderer.ts
    ├── AuthManager (modules/auth.ts)
    ├── CalendarManager (modules/calendar.ts)
    │   └── escapeHtml (utils/dom.ts)
    ├── WebViewManager (modules/webview.ts)
    ├── CookieManager (modules/cookies.ts)
    │   └── escapeHtml (utils/dom.ts)
    ├── CheckinManager (modules/checkin/index.ts)
    │   ├── AttendanceAnalyzer (modules/checkin/analyzer.ts)
    │   │   ├── parseTimestamp, formatDate, formatTime (utils/date.ts)
    │   │   └── AttendanceSituation (types.ts)
    │   ├── CheckinDialog (modules/checkin/ui.ts)
    │   │   ├── escapeHtml (utils/dom.ts)
    │   │   ├── ApprovalItem, AttendanceClockType (types.ts)
    │   └── CheckinExecutor (modules/checkin/executor.ts)
    │       ├── parseTimestamp (utils/date.ts)
    │       └── ApprovalItem (types.ts)
    ├── getAdjacentMonth (utils/date.ts)
    └── toggleDropdown, closeAllDropdowns (utils/dom.ts)
```

---

## 优势

### 1. **单一职责原则**
每个模块只负责一个明确的功能，易于理解和维护。

### 2. **代码复用**
工具函数（日期、DOM）可以在多个模块中复用。

### 3. **易于测试**
每个模块都可以独立测试，不需要依赖整个应用。

### 4. **清晰的依赖关系**
从文件结构和 import 语句就能看出模块间的依赖。

### 5. **降低耦合**
模块间通过接口和回调通信，降低了耦合度。

### 6. **更好的可维护性**
修改某个功能不会影响其他模块。

### 7. **代码量大幅减少**
主入口文件从 1174 行减少到 325 行（减少 72%）

---

## 代码统计

| 文件 | 行数 | 说明 |
|------|------|------|
| `renderer.ts` | 325 | 主入口（原 1174 行） |
| `types.ts` | 30 | 类型定义 |
| `utils/date.ts` | 50 | 日期工具 |
| `utils/dom.ts` | 25 | DOM 工具 |
| `modules/auth.ts` | 110 | 认证管理 |
| `modules/calendar.ts` | 155 | 日历管理 |
| `modules/webview.ts` | 80 | WebView 管理 |
| `modules/cookies.ts` | 145 | Cookie 管理 |
| `modules/checkin/index.ts` | 110 | 一键打卡主逻辑 |
| `modules/checkin/analyzer.ts` | 160 | 考勤分析器 |
| `modules/checkin/ui.ts` | 290 | UI 渲染 |
| `modules/checkin/executor.ts` | 95 | 补签执行器 |
| **总计** | **1575** | **vs 原 1174 行** |

虽然总代码量略有增加（+401 行），但考虑到：
- 增加了完整的类型定义
- 增加了工具函数复用
- 增加了详细的注释和文档
- 大幅提升了代码的可维护性和可读性

这是非常值得的权衡。

---

## 未来扩展

得益于模块化设计，未来可以轻松添加新功能：

1. **添加新的考勤报表模块**
   ```
   modules/report/
   ├── index.ts
   ├── generator.ts
   └── exporter.ts
   ```

2. **添加设置模块**
   ```
   modules/settings/
   ├── index.ts
   └── preferences.ts
   ```

3. **添加通知模块**
   ```
   modules/notification/
   └── index.ts
   ```

每个新模块都可以独立开发、测试和维护，不会影响现有功能。
