# DSH 插件生态倡议书

[English](plugin-ecosystem.en.md) | 中文

DSH 的插件生态正在快速增长。插件越多，它们能否协同工作就越重要：如果每个插件都假设甚至覆盖其他插件的内部实现，装几个插件就会开始冲突，生态会逐渐碎片化。这不是任何人的错，而是缺少共同约定的必然结果。

## 我们的愿景

我们希望构建一个**开放、可组合、可持续**的 DSH 插件生态：

- **开放**：任何作者都可以参与，官方、桌面和第三方插件在同一个平台上平等组合。
- **可组合**：插件按同一套约定扩展，装在一起也能一起工作、互不干扰。
- **可持续**：升级保持向后兼容，生态可以长期演进，不需要推倒重来。

## 我们倡导的三条原则

1. **组合优先**：通过官方 slot、service 和 patch 组合能力，不要假设或覆盖其他插件的内部实现。
2. **声明清晰**：明确声明依赖的 service 和 slot，不依赖运行时巧合。
3. **兼容优先**：升级保持向后兼容，不破坏已有组合。

## 桌面壳是第一个范例

DSH Desktop 是这套方式的第一个实践者：桌面壳本身就是一个普通 DSH 插件，与官方、第三方插件走同一条组合路径，没有任何特权。我们不是魔改上游源码做一个固定外壳，而是让"桌面"也成为插件生态里平等的一员。

## 活文档，社区共建

这份倡议不是单方面规定，而是一份**活文档**：它随生态实践更新，接受社区讨论和修订。任何作者都可以通过 issue、讨论区或 PR 提出修改。

## 插件市场：让约定成为有利的选择

插件市场已经内置。收录和发现由用户选择的目录来源决定；遵循本倡议不会自动获得收录、排名或推荐。倡议的直接价值是让插件更容易组合、维护和判断兼容边界。目录收录、内置 adapter 和**可安装**状态也都不等于安全审核、推荐或背书。

## 从倡议走向可测试的 contract

[DSH Community Fabric](../dsh-community-fabric/README.zh.md) 正在把这份愿景整理成可公开讨论的 Manifest、Capability、Host Descriptor 与事件 Draft。它目前只有文档，不是已经发布的标准或运行时；当前插件仍使用现有 DSH/Cordis 接口。

Fabric 的 capability 首先用于兼容判断、用户确认和审计，不会把同进程 JavaScript 伪装成安全沙箱。只有具备真实隔离证据的 Host 才能声称权限被技术强制执行。

当前 [DSH Community Market](../dsh-community-market/README.zh.md) 已实现公开来源契约、用户添加来源、合作来源 adapter 和受管 package 操作。来源接入、中立、重大关系披露、限制与复核遵循[目录数据源治理与合作政策](../dsh-community-market/docs/catalog-source-governance.zh.md)。

## 如何参与

- 在[插件开发](plugin-development.md)中了解插件如何编写。
- 阅读并评论 [Community Fabric RFC 0001](../dsh-community-fabric/docs/rfcs/0001-plugin-manifest-capabilities-events.zh.md)。
- 在[用户指南](user-guide.md)中了解如何安装和管理插件。
- 通过 issue 和讨论区提出你对本倡议的意见。
