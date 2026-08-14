# Agent Note: 纯新增 Cordis 桌面包

Status: proposed

[English](2026-08-14-additive-cordis-desktop-package.md) | 中文

## 问题

DSH 需要一个可安装的桌面应用，但 Electron 不能成为第二个组合权威。只启动固定 Web profile、维护硬编码客户端花名册或修改现有 UI 包的桌面启动器可以显示当前产品，却无法让通过 `dsh plugin --profile desktop add <package>` 安装的第三方包成为桌面行为的一等所有者。

该实现还受到纯新增约束：不能修改现有 DSH 包及其 Cordis row。当前客户端模块目录与连接 provider 都与 Web server 耦合，因此独立包无法自行引入零端口 IPC carrier。桌面包必须保留现有 Host 与浏览器 Cordis 树，同时隔离不可避免的 Electron 启动代码。

## 提案

把 `dsh-plugin-desktop` 作为独立的 DSH 双面包发布，并将其可执行程序分发为 **DSH Desktop** 应用。Electron 可执行文件只执行 Cordis 树创建前必需的操作：获取单实例锁、准备持久化 `desktop` profile、提供 Electron 运行时能力，并在 Electron main 进程中启动 Host Cordis 根。窗口、托盘、导航、关闭与退出以及 renderer generation 的所有权都属于 `desktop-shell` Host 插件，并由一个 Cordis effect 持有。其客户端产物像其他 `dsh.client` 包一样由现有客户端模块图加载。

第一阶段复用现有 Web carrier。启动器组合 `PROFILE_TEMPLATES.web`，将 `webserver` 绑定到 `127.0.0.1` 的临时端口，并把生成的同源页面载入沙箱 `BrowserWindow`。这是纯新增实现约束，不是新的 transport abstraction。renderer 保留现有 fetch 与 WebSocket 连接 provider、Host 提供的插件图、内置客户端 Loader、slot 与 service。

持久化 profile 以普通 Web template bundle 开头。profile 修复会把必需的 `dsh-base` 与 `dsh-web-app` 前缀放在最前，移除持久化列表中的启动器包，并保持每个第三方 bundle 的相对顺序。启动器把自己的 desktop patch 插入 Web application layer 之后、第三方 layer 之前。profile 本地与整机用户 patch 仍在 bundle layer 之后应用；仅允许 loopback 的 Web server overlay 继续作为启动器最终拥有的安全不变量。

在严格纯新增约束下，本提案收窄了 [GUI 分层与 RPC 协议](../../implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md)描述的实现路线，并保留[客户端插件加载模型](../../implemented/architecture/2026-07-23-client-plugin-loading-model.md)。它不取代其中任何一项。以后可以由上游提供 transport-neutral 能力，用 IPC 替换 loopback carrier，而无需改变 profile 所有权或两棵 Cordis 插件树。

## 备选方案

**把 `dsh web` 作为受监管子进程启动。** 该方案可以快速复用产品，但会让桌面生命周期留在 Host Cordis 树之外，并由启动器而非插件拥有原生行为。

**完全在独立包内实现 Electron IPC carrier。** 现有客户端模块会直接选择 Web fetch 与 WebSocket provider，而 Host connection row 会在 `webServer` 上注册路由。独立包无法在不修改或复制上游组合的情况下替换两侧。

**把 `dsh-plugin-desktop` 持久化到 profile bundle 列表。** 该包已经从自身安装锚点插入自己的 layer。如果仍然持久化，启动时会依赖 profile package resolution 找到启动器自身，并可能产生重复 row。将它归启动器所有，可使持久化列表完全由普通插件管理负责。

**分叉 Web 客户端或维护 Electron 插件花名册。** 两种选择都会创建第二个组合权威。第三方 `dsh.client` 包将需要 Electron 专用注册或构建，无法继续遵循 Host 提供的图。

## 验收标准

- headless profile 测试证明：最初只包含 `dsh-base` 和第三方 bundle 的 profile 会被修复为 Web template 前缀，同时保留第三方顺序与未知 manifest 字段。
- desktop patch 在 `dsh-web-app` 之后、第三方 bundle layer 之前组合；profile 与整机 patch 保持既定优先级。
- Host 插件通过 Cordis effect 拥有原生外壳的创建与释放；关闭窗口会保留 Host，而应用退出与进程信号会使用带超时和重复请求升级的有界 Cordis dispose。
- 浏览器产物以 `dsh-plugin-desktop` 图 id 注册到现有客户端模块 loader，并在 fiber dispose 时清理 renderer marker。
- renderer 不启用 Node integration，也不获得原始 Electron API；精确同源导航停留在 loopback surface；外部允许链接在应用窗口外打开。
- npm 启动器的 headless `--help` 与 `--version` 路径无需导入 Electron；普通启动则运行持久化 `desktop` profile。
- package 级检查会编译两个 face、typecheck 源码与测试、运行 profile 与生命周期聚焦测试，并验证发布文件集合。
- 正式发布前，各原生平台 job 会验证打包后运行时闭包、从已安装 profile 激活第三方 Host 与 client 插件、安装器行为、签名以及平台信任检查。
- 安装器发布版本要提供显式插件管理路径，无需假设用户另外安装 Node、DSH CLI 或 pnpm 即可安装 profile 依赖。

## 风险

Loopback HTTP 与 WebSocket 仍是进程内可到达的网络 surface。绑定 `127.0.0.1`、使用临时端口、验证精确 renderer origin 且不暴露 Electron bridge，可以限制第一阶段的风险，但无法提供 IPC transport 的可达性特征。

Electron 可执行文件仍然包含少量 Cordis 前置启动代码，因为任何插件都不能创建承载它的树。如果不要求后续窗口、托盘与操作系统集成都通过运行时能力和 Cordis-owned effect 进入，原生行为仍可能重新漂移到该启动代码中。

已发布的 DSH prerelease 包可以独立于父级源码 checkout 演进。因此，该独立项目固定使用确切包版本，并验证已安装的公开接口。发布时必须把 DSH family 作为经过共同测试的一组更新，而不能依赖 dist tag。

第一阶段不监听 profile manifest 变化。添加或删除包后必须重启应用；格式错误的第三方 layer 仍会在启动期间由普通 DSH Loader 明确失败。

源码与 npm 工作流可以使用另外安装的 `dsh plugin` 命令，但只有安装器的用户目前没有 package manager 入口。内置或代理该管理命令时必须保留同一套 profile manifest 与 package 安装语义，不能创建由 Electron 拥有的 registry。
