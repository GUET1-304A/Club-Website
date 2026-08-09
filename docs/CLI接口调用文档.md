# CLI 命令行接口调用文档

> 对应任务书：任务 6（Web 界面 + CLI 命令行双接口）
> 实现位置：`cli/` 目录，纯 Python 标准库 + Click，复用后端 REST API。

## 一、概述

CLI 与 Web 端共享同一后端数据库：所有命令都调用 `/api/*` REST 接口，
任意一端的数据变更在另一端立即可见，不存在单独的数据副本。

## 二、运行方式

无需安装，后端环境已包含 Click（Flask 依赖）：

```bash
# 从仓库根目录运行
python -m cli --help
python -m cli auth login
```

也可将仓库根目录加入 `PYTHONPATH` 后直接执行 `cli/xingyu.py`。

## 三、配置

### 3.1 服务器地址

优先级：命令行 `--base-url` > 环境变量 `XINGYU_BASE_URL` > 本地配置文件。

```bash
export XINGYU_BASE_URL=http://localhost:5000   # 开发环境
python -m cli --base-url https://example.com auth status
```

### 3.2 本地会话

登录后凭证保存在 `~/.xingyu-cli/config.json`
（可用 `XINGYU_CLI_HOME` 覆盖目录）。文件包含服务器地址、token、角色与账号名。

```bash
python -m cli auth login        # 交互输入账号密码
python -m cli auth status       # 查看当前会话
python -m cli auth logout       # 清除凭证
```

## 四、命令参考

全局选项：

| 选项 | 说明 |
|------|------|
| `--base-url URL` | 覆盖后端地址 |
| `--json` | 所有命令以 JSON 输出（便于脚本/大模型解析） |
| `--help` | 命令帮助 |

### 认证

| 命令 | 说明 |
|------|------|
| `auth login [--account A] [--password P]` | 统一认证登录（自动识别管理员/成员） |
| `auth logout` | 清除本地凭证 |
| `auth status` | 查看服务器、角色、账号 |
| `status` | 服务健康检查 + 当前会话 |

### 项目

| 命令 | 说明 |
|------|------|
| `project list [--status active]` | 项目列表（管理员/成员/公开视角） |
| `project show <ID或slug>` | 项目详情（成员视角含里程碑与任务） |
| `project create --name X [--category web] ...` | 创建项目（管理员） |
| `project update <ID> --name X --status completed` | 更新项目（管理员） |

### 任务

| 命令 | 说明 |
|------|------|
| `task list [--project ID] [--status] [--mine]` | 任务列表（成员看自己的，管理员按项目） |
| `task create --project ID --title X [--assignee-id] [--due-date]` | 创建任务 |
| `task update <ID> [--status] [--priority] ...` | 更新任务字段 |
| `task status <ID> --status in_progress` | 快速变更任务状态 |

### 周报

| 命令 | 说明 |
|------|------|
| `report list [--status submitted]` | 周报列表（成员/管理员） |
| `report show <ID>` | 周报详情（含 AI 分析） |
| `report submit --done X [--plan] [--issues] [--draft]` | 创建并提交周报（成员） |
| `report analyze <ID>` | AI 分析周报（成员自己的或管理员任意） |
| `report review <ID> [--note] [--completion-rate 90]` | 审阅周报（管理员） |

### 成果

| 命令 | 说明 |
|------|------|
| `award list [--level national]` | 成果/奖项列表 |
| `award export [--format json\|csv] [--output file] [--level]` | 成果导出（stdout 或文件） |

### 成员

| 命令 | 说明 |
|------|------|
| `member list [--group dev] [--search 关键词]` | 成员目录（管理员含完整信息） |

### 配置与提醒

| 命令 | 说明 |
|------|------|
| `config get [KEY]` | 查看站点配置（管理员） |
| `config set KEY VALUE` | 设置配置项，合法 JSON 自动解析（管理员） |
| `reminder list [--status pending]` | 提醒列表 |
| `reminder create --title X [--scheduled-at] [--member-id]` | 创建提醒 |
| `reminder complete <ID>` | 完成提醒（成员） |
| `notify list [--unread]` | 站内通知（成员） |

## 五、输出格式

默认输出人类可读表格；加 `--json` 输出原始 JSON：

```bash
python -m cli project list --status active --json
```

```json
[
  {
    "id": 1,
    "slug": "campus-hub",
    "name": "Campus Hub",
    "status": "active",
    "category": "web"
  }
]
```

## 六、脚本/大模型集成示例

```bash
# 查询进行中项目名称（jq 需要另行安装；也可用 python -c 解析）
python -m cli project list --status active --json

# 导出全部成果为 CSV 供报表使用
python -m cli award export --format csv --output awards.csv

# 大模型自动操作示例：任务状态流转
python -m cli task status 42 --status done --json

# 周报提交提醒：创建定时提醒
python -m cli reminder create --title "周五提交周报" \
  --scheduled-at "2026-08-14T18:00:00+08:00"
```

错误时退出码为 1，错误信息输出到 stderr，格式为 `错误[状态码]: 消息`，
401/403 会附带重新登录提示。

## 七、权限矩阵

| 命令 | guest | member | admin |
|------|-------|--------|-------|
| status / auth status | ✅ | ✅ | ✅ |
| project list / show | ✅（公开信息） | ✅ | ✅ |
| project create / update | ❌ | ❌ | ✅ |
| task list | ❌ | ✅（自己的） | ✅（按项目） |
| task create / update / status | ❌ | ✅ | ✅ |
| report submit | ❌ | ✅ | ❌ |
| report review | ❌ | ❌ | ✅ |
| report analyze / show / list | ❌ | ✅（自己的） | ✅ |
| award list / export | ✅ | ✅ | ✅ |
| member list | ✅（公开） | ✅（含联系方式） | ✅（完整） |
| config get / set | ❌ | ❌ | ✅ |
| reminder create / list | ❌ | ✅（自己的） | ✅（可指定成员） |
| notify list | ❌ | ✅ | ❌ |

## 八、测试

```bash
cd backend
python -m pytest tests/test_cli.py -q    # 9 个端到端用例
```

测试会真实启动 Flask 服务（随机端口），通过 Click 运行器调用 CLI，
并直接查询 Web API 验证双端数据同步。

