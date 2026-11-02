# Roy · AI 工作作品集

围绕企业流程、AI 应用与数据分析，展示从业务问题拆解、方案设计到交互实现和验证的工作方法。

**展示说明**：本仓库节选过往实践中的代表性项目与功能模块，并收录个人探索项目。为保护相关方信息，展示版本经过脱敏、数据替换与运行环境隔离，仅用于个人能力展示、面试交流和技术讨论。演示数据、模拟接口与实际验证范围在各项目中分别标注；画面中的指标不作为原项目业务成效的披露。详见[展示范围与资料说明](DISCLOSURE.md)。

初次访问建议按“审批辅助 → 平台运营 → 舆情观察”的顺序阅读，先看业务问题与关键取舍，再查看代码、截图和验证记录。[案例导览](docs/PROJECT_GUIDE.md)提供每个项目的阅读重点和演示路径。

## 项目

| 项目 | 展示能力 | 当前状态 |
| --- | --- | --- |
| [【正式demo】企业审批辅助助手](projects/approval-assistant/) | Dify、规则与字段管理、材料完整性校验、采购金额核对、AI 辅助总结 | Dify Cloud 演示可运行；内置虚构数据，模拟回调不保存、不写回 |
| [AI 平台运营看板](projects/operations-dashboard/) | 时间与渠道筛选、用户分层、运营指标口径 | 原有聚合逻辑，替换为合成数据 |
| [FC Social Radar · 游戏舆情观察](projects/fc-social-listening/) | 社交平台采集、事件聚合、样本热度、关联与影响判断、证据追溯及中文简报 | 可运行原型；[真实采集快照](https://zgjsczsyc.github.io/fc-social-radar-snapshot/)，人工质量验收待完成，非 EA 官方产品 |
| [日志活动分析](projects/log-analysis/) | 软件分类、部门与人员视角、浏览器端数据分析 | 独立看板，默认合成日志 |
| [通知中心](projects/notification-center/) | Vue、Pinia、后台任务反馈、两类未读状态 | 独立本地模拟，不连接企业接口 |
| [房屋三维交互模型](projects/home-model/) | Three.js、空间建模、家具交互、平面图 | 保留交互，去除住宅名称与参考照片 |

## 无需安装即可查看

- [审批辅助案例](projects/approval-assistant/docs/case-study.md)：工作流设计、异常处理与测试范围。
- [平台运营截图](projects/operations-dashboard/preview.png)与[通知交互截图](projects/notification-center/preview.png)：从指标观察到后台任务反馈。
- [舆情观察案例](projects/fc-social-listening/docs/portfolio-case-study.md)与[在线只读快照](https://zgjsczsyc.github.io/fc-social-radar-snapshot/)：证据追溯、判断依据与覆盖缺口。

本仓库中的 `127.0.0.1` 地址用于在访问者自己的电脑上启动演示，不是线上托管地址。除明确标注的舆情快照外，网页项目需按下方步骤在本地运行。

## 本地展示五个网页项目

需要 Python 3.9+、Node.js 24+。首次运行先克隆并构建三个前端项目：

```bash
git clone https://github.com/zgjsczsyc/royai-work-portfolio.git
cd royai-work-portfolio
for project in home-model notification-center fc-social-listening; do
  (cd "projects/$project" && npm ci && npm run build) || exit 1
done
```

然后在仓库根目录执行：

```bash
python3 serve.py
```

浏览器打开 `http://127.0.0.1:8765`，选择项目；Ctrl+C 停止全部服务。所有服务仅监听本机，页面运行无需企业登录或模型密钥。

构建产物和依赖目录不提交 Git。已完成构建后，后续演示只需运行 `python3 serve.py`。

FC Social Radar 的本地入口为 `http://127.0.0.1:8772`，使用内存中的 60 条合成帖子和 12 个事件，退出后丢弃，不打开真实数据库或登录会话。公开的[真实采集快照](https://zgjsczsyc.github.io/fc-social-radar-snapshot/)为独立只读页面，保留待核实与覆盖缺口。设计取舍、实测结果和限制见[项目案例](projects/fc-social-listening/docs/portfolio-case-study.md)。

浏览器验收脚本需要本机 Chrome：根目录运行 `npm ci`，启动展示服务后执行 `npm run test:showcase`。测试截图保存在各项目的 `preview.png`，测试日志在被 Git 忽略的 `test-results/`。

## 在本机演示审批辅助链路

云端演示应用为[【正式demo】企业审批辅助助手](https://cloud.dify.ai/app/1b7a27d9-da8d-4759-af07-a643ed14c41a/workflow)。此链接打开 Dify 工作流编辑页，需要登录并拥有对应工作区权限。

在自己的 Dify 工作区复现时，导入 [workflow-cloud.yml](projects/approval-assistant/workflow-cloud.yml)，并在两个 LLM 节点配置可用模型。该版本内置虚构数据，无需启动本地服务；采购回调只展示说明，不保存或写回。操作步骤见[项目说明](projects/approval-assistant/README.md#dify-官方云端使用内置数据版)。

```bash
git clone https://github.com/zgjsczsyc/royai-work-portfolio.git
cd royai-work-portfolio/projects/approval-assistant
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python demo.py
```

`demo.py` 使用本地模拟服务，不需要模型密钥，也不调用模型。Dify 导入及模型配置见[项目说明](projects/approval-assistant/README.md)。

## 阅读与验证

- [案例导览与能力对应](docs/PROJECT_GUIDE.md)
- [展示范围与资料说明](DISCLOSURE.md)
- [验证记录](VALIDATION.md)

代码整理、独立演示适配和测试使用 AI 工具辅助。前台通知和运营看板为原应用的功能节选；FC 舆情为个人探索原型。项目经历、展示实现和测试结论分别说明，不将模拟数据或技术测试等同于真实业务效果。
