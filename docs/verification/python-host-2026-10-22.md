# 服务器发布解释器解阻（2026-10-22）

## 授权、起点与边界

- 用户在确认宿主Python3.6.8阻塞发布后明确授权“可以修改”，随后提醒服务器操作参考项目文档。本轮已读AGENTS、《生产更新手册》《上线检查清单》、deployment及发布设计/交接，继续使用既定Workbench、实例/地域和目录，不在服务器git pull。
- 本轮开始 `main / b1aced0235374c91e438fd1d75c545a9994518ae`，与origin/main一致、工作区干净。上轮正式HEAD的CheckOnly和[托管CI39785114451](https://github.com/GUET1-304A/Club-Website/actions/runs/39785114451)均通过；3001预览已恢复（旧交接中“暂时停止”是历史阶段）。
- 授权用于宿主运行环境解阻与相应发布脚本/运维文档维护；未授权正式网站发布。本轮没有构建/替换线上应用镜像，没有停/重启网站容器、迁移/覆盖业务数据、修改.env/秘密/证书/cron。

## 服务器实际变更

- Alibaba Cloud Linux3 Update9、x86_64；官方alinux3-updates提供 `python3.11-3.11.13-7.0.1.al8`。依照[阿里云官方并行安装说明](https://help.aliyun.com/zh/alinux/support/install-a-newer-python-3-on-alibaba-cloud-linux-3)安装，没有替换系统Python。
- 先预览交易、下载RPM并逐个`rpmkeys --checksig`，六个包均签名/摘要OK；读取安装脚本及alternatives优先级后确认系统3.6优先级1000000，高于3.11的31100，不需要更改系统默认选择。
- 实际命令限定官方 `alinux3-os` / `alinux3-updates`，关闭可选弱依赖，不更改全局源配置：`dnf --disablerepo='*' --enablerepo=alinux3-os --enablerepo=alinux3-updates --setopt=install_weak_deps=False -y install python3.11`。
- 新增5包：python3.11、python3.11-libs、python3.11-pip-wheel、python3.11-setuptools-wheel、mpdecimal。必需依赖chkconfig从1.19.1-1.al8升级为1.19.2-1.al8；排除它的预演无法满足alternatives依赖，没有使用skip-broken或强装。
- `/usr/bin/python3.11`为3.11.13；`python3`仍3.6.8，解析目标仍`/usr/libexec/platform-python3.6`。dnf --version仍正常。spacewalk插件的OpenSSL兼容警告在安装前已存在，安装后仍有，未在本轮扩大修改该系统组件。
- 安装前后两个网站容器ID及StartedAt严格相同：backend仍healthy；frontend保持原运行状态。未触发应用初始化/数据库迁移。

## 仓库变更

- `scripts/deploy-remote.sh`在获取发布锁/运行Docker之前探测兼容Python3.9+，默认先试系统python3，再试带版本命令；本机真实选中`/usr/bin/python3.11`。同一个解释器用于prepare-compose、recovery、卷名解析、HTTP smoke。
- 可通过`RELEASE_PYTHON`明确指定命令/绝对路径；指定无效或低版本时失败，不悄悄回退。探测还验证Python输出标记，空输出的非Python程序不能误通过。
- 新增`--check-runtime`，只报告解释器/版本，不获取发布锁、不构建、备份、启动容器或推进发布指针；不能代替完整CheckOnly。
- 回归测试覆盖系统命令不受支持时选择并行3.11、显式低版本拒绝、非Python命令拒绝，以及原有build/smoke/orphan失败路径。
- 更新deployment、《生产更新手册》《上线检查清单》：人工恢复示例使用python3.11；手册统一新发布门禁、独立发布目录和数据恢复边界；移除旧的原目录解压覆盖与活库删除复制示例。

## 验过什么

- 隔离Python3.12 Linux运行 `test_release_operations.py`、`test_deployment_contract.py`：**31 passed**，包含全部POSIX新旧用例。只读挂载仓库，未挂业务数据卷。
- 真实宿主Python3.11导入ssl/sqlite3/pathlib/tarfile/argparse/hashlib/urllib.request通过；标准库报告SQLite3.26.0、OpenSSL1.1.1k FIPS（操作系统供应商构建）。
- 通过Workbench在自动清理的临时目录放置本轮发布工具及两份新Compose配置，只执行`--check-runtime`、模块导入、`prepare_compose`：选中/usr/bin/python3.11；release/recovery导入通过；对真实旧容器配置、.env引用路径、秘密文件和业务挂载的一致性验证通过。没有build/up/backup，也没有读取业务数据库内容。
- 该配置预检前后网站容器ID/StartedAt、Docker卷集合严格不变；临时源码与私有解析配置自动删除。传送的是显式列出的源码/配置文本，不包含.env或密钥；输出只含验收摘要。
- 完整正式提交、CheckOnly与托管CI由本轮收尾继续执行；最终SHA/结果见[本地运行报告](2026-10-22.release-report.json)及[托管workflow](https://github.com/GUET1-304A/Club-Website/actions/workflows/frontend.yml)。运行报告是已被Git忽略的验收产物，不改变干净工作区；克隆副本缺失时按实际HEAD查CI。

## 补读运维文档后的只读核对

- 旧每日备份脚本 `/usr/local/bin/backup-304aistudio.sh`、03:00 root cron真实存在；实际目录是 `/root/backups/304aistudio-daily/`，修正旧手册缺少`-daily`的路径。
- 现场看到8个文件，最近为 `xingyu_cms-20261022-030001.db`（245760字节）及 `uploads-20261022-030001.tgz`（2205880字节）。只查名称/大小；没有打开业务内容或恢复。旧脚本使用SQLite backup与tar，没有新manifest。
- 旧证书续期脚本 `/usr/local/bin/renew-304aistudio-cert.sh`及每天04:10 cron存在，两个脚本均0700；未执行它们，也没有运行可能触发容器控制的续期演练。
- 因此旧交接中“日常定时备份未设置”的笼统结论被本轮核对更新：**旧版定时备份存在，新版发布备份格式/离线恢复流程不同；异地副本、旧备份内容恢复及真实数据切流仍未验证**。

## 证据、下一步与未验证

本地证据：`$env:TEMP/xingyu-release-gate-20261022/` 中 python-host-inventory.json、python-package-plan.json、python-package-download.json、python-alternatives-before.json、python-install.json、python-runtime-tests.log、host-runtime-validation.json、maintenance-inventory.json。只有运行日志/源码，不保存API token，不输出真实密钥。服务器保留本轮签名RPM下载目录 `/var/tmp/xingyu-python-plan.oIMwK8/`，未清空系统/镜像缓存。

新会话从本文件和《生产更新手册》进入：先核对main/HEAD/干净状态和对应CI，再复核主机解释器与现有容器。**Python版本阻塞已消除；系统python3不需要也不应替换。** 新的自动选择脚本随正式发布归档进入独立release目录，旧安装根目录尚未被改写。

尚未执行正式发布、发布后新版本readiness/真实SHA验收、真实业务数据备份切流/恢复、真实账号业务、真实手机/弱网及外部服务验收。日常异地备份、旧cron恢复有效性与既有spacewalk插件警告也不在本轮完成范围。正式部署仍使用新门禁脚本，并需要用户对发布动作的明确授权；不得因为本次允许修改Python环境而自动上线。
