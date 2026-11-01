# Roy · AI 工作作品集

记录 AI 工作流、业务流程自动化和数字化工具的设计与实现。每个项目保留独立的运行说明、业务案例和验证记录，便于本地演示与面试交流。

## 项目

| 项目 | 展示能力 | 当前状态 |
| --- | --- | --- |
| [企业审批辅助助手](projects/approval-assistant/) | Dify、OA/BPM 系统适配、规则与字段管理、材料核对、模拟写回 | 本地代码与 Mock 回归测试通过；Dify 实机及模型验证待完成 |
| [日志活动分析](projects/log-analysis/) | 软件分类、部门与人员视角、浏览器端数据分析 | 独立看板，默认合成日志 |
| [AI 平台运营看板](projects/operations-dashboard/) | 时间与渠道筛选、用户分层、运营指标口径 | 原有聚合逻辑，替换为合成数据 |
| [通知中心](projects/notification-center/) | Vue、Pinia、后台任务反馈、两类未读状态 | 独立本地模拟，不连接企业接口 |
| [房屋三维交互模型](projects/home-model/) | Three.js、空间建模、家具交互、平面图 | 保留交互，去除住宅名称与参考照片 |

## 私有仓库显示 404 时

GitHub 会向未登录或无权限的浏览器隐藏私有仓库。**先在浏览器中登录 `zgjsczsyc`**，然后再打开仓库。终端 `gh` 已登录，不代表 Chrome 或其他浏览器也已登录。

[登录 GitHub 并返回本仓库](https://github.com/login?return_to=%2Fzgjsczsyc%2Froyai-work-portfolio)

仓库继续保持私有，不需要为了消除 404 改成公开。

## 本地展示四个网页项目

本机已完成前端构建，可在仓库根目录直接执行：

```bash
python3 serve.py
```

浏览器打开 `http://127.0.0.1:8765`，选择项目；Ctrl+C 停止全部服务。所有服务仅监听本机，页面运行无需企业登录或模型密钥。

首次在另一台电脑克隆后，需先安装 Node.js 20.19+ 或 22.12+，分别进入 `projects/home-model`、`projects/notification-center` 执行 `npm ci` 与 `npm run build`，再回到根目录启动展示。构建产物和依赖目录不上传 GitHub。

浏览器验收脚本需要本机 Chrome：根目录运行 `npm ci`，启动展示服务后执行 `npm run test:showcase`。测试截图保存在各项目的 `preview.png`，测试日志在被 Git 忽略的 `test-results/`。

## 在本机演示审批辅助链路

```bash
git clone https://github.com/zgjsczsyc/royai-work-portfolio.git
cd royai-work-portfolio/projects/approval-assistant
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python demo.py
```

仓库为私有，克隆前需登录有访问权限的 GitHub 账号。`demo.py` 使用本地模拟服务，不需要模型密钥；真实 Dify 演示见项目说明。

## 后续项目

新项目放在 `projects/<project-name>/`，在本页增加入口。每个项目说明业务问题、实现方式、运行步骤、已验证结果及限制。

本仓库仅包含作品集演示材料与虚构业务数据，不放原始业务资料、内部规则表或真实凭据。前台通知和后台运营看板是从原应用提取的演示模块，不等同于完整企业平台；各项目 README 说明保留与模拟的范围。
