# Roy · AI 工作作品集

记录 AI 工作流、业务流程自动化和数字化工具的设计与实现。每个项目保留独立的运行说明、业务案例和验证记录，便于本地演示与面试交流。

## 项目

| 项目 | 展示能力 | 当前状态 |
| --- | --- | --- |
| [企业审批辅助助手](projects/approval-assistant/) | Dify、OA/BPM 系统适配、规则与字段管理、材料核对、模拟写回 | 本地代码与 Mock 回归测试通过；Dify 实机及模型验证待完成 |

## 在本机开始

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

本仓库仅包含作品集演示材料与虚构业务数据，不放原始业务资料、内部规则表或真实凭据。
