"""星雨作坊 CMS — 默认种子数据

定义站点首次初始化时的默认配置和初始 CMS 页面内容。
这些数据在 app.py 的 _seed_defaults() 和 _ensure_pages() 中写入数据库，
仅当数据库中不存在对应记录时才会插入（避免覆盖已有数据）。
"""

# ────────────────────────────────────────────────────────────────
# 默认站点配置 (SiteConfig 表)
# ────────────────────────────────────────────────────────────────
# 成员统一初始密码：开发/演示环境在建档时使用，成员可用学号 + 该密码登录成员门户，
# 登录后可在「个人中心」自行修改密码（系统不强制改密）。
INITIAL_MEMBER_PASSWORD = 'Xingyu@2026'

# 这些配置项在首次启动时写入 site_config 表。
# 管理员可通过 /api/admin/config 接口在线修改，修改后的值将覆盖此处默认值。

DEFAULT_SITE_CONFIG = {
    # ─── 首页 Hero 区域 ───
    # 控制首页顶部大标题、描述和统计数字的显示内容
    'hero': {
        'eyebrow': 'XINGYU STUDIO',                         # 眉题（标题上方的标签文字）
        'title': '把灵感变成**作品**，\n把热爱做成**长效主义**。',  # 主标题（**文字** 渲染为衬线强调）
        'description': '星雨作坊是一个面向产品、设计与技术协作的校园创意社团。我们围绕真实项目进行学习、共创和开源。\n\n把想法一步步做成可被看见、可被使用、可持续迭代的作品。',
        'stats': [                                           # 统计数据（显示在 Hero 下方的数字卡片）
            {'label': '成立年份', 'value': '2020'},
            {'label': '成员数', 'value': '42+'},
            {'label': '获奖数', 'value': '28+'},
            {'label': '项目数', 'value': '36+'},
        ],
        'primary_label': '了解我们',                          # 主按钮文字
        'primary_href': '/about',                            # 主按钮链接
        'secondary_label': '加入社团',                        # 次按钮文字
        'secondary_href': '/join',                           # 次按钮链接
    },

    # ─── 关于我们区域 ───
    'about': {
        'title': '一个由**学生**打造的\n**创造者**社群',
        'description': '星雨作坊成立于 2020 年，从最初的几人小组发展为涵盖前端、后端、设计、算法、产品五大方向的综合性学生开发社团。我们承接真实项目、参与各类竞赛、举办技术分享，致力于让每一位成员在实践中成长。',
        'extra': '在这里，没有严格的上下级，只有共同热爱技术的伙伴。每一个想法都值得被认真对待，每一行代码都在创造价值。',
        'items': [                                           # 特色条目（图标 + 标题 + 描述）
            {'title': '项目驱动', 'description': '以真实项目为核心，在实践中学习和成长'},
            {'title': '技术分享', 'description': '定期举办技术分享会，互相学习共同进步'},
            {'title': '竞赛参与', 'description': '组织参加各类技术竞赛，以赛促学'},
            {'title': '开源贡献', 'description': '积极参与开源社区，回馈技术生态'},
        ],
    },

    # ─── 成员展示区域 ───
    'members': {
        'description': '来自不同专业、不同年级的创造者们',
        'eyebrow': 'TEAM',
        'title': '我们的**成员**',
        'cta': '查看全部成员 →',
        'groups': [                                          # 成员分组定义（对应 Member.group 字段）
            {'name': '流光组', 'tag': '产品', 'description': '负责产品设计、用户研究、需求分析'},
            {'name': '星绘组', 'tag': '设计', 'description': '负责UI/UX设计、品牌视觉'},
            {'name': '逐云组', 'tag': '开发', 'description': '负责前后端开发、技术架构'},
            {'name': '拾焰组', 'tag': '内容', 'description': '负责技术写作、社区运营'},
        ],
    },

    # ─── 首页作品/奖项/加入区域标题 ───
    'projects': {
        'eyebrow': 'WORKS',
        'title': '我们的**作品**',
        'cta': '查看全部作品 →',
    },
    'awards': {
        'eyebrow': 'HONORS',
        'title': '比赛**奖项**',
        'cta': '查看全部奖项 →',
    },
    'join': {
        'eyebrow': 'WHY JOIN',
        'title': '为什么**加入**我们',
        'cta_eyebrow': 'JOIN US',
        'cta_title': '**加入**我们',
        'cta_description': '无论你是编程新手还是技术大牛，只要你对技术充满热情，星雨作坊都欢迎你的加入。',
        'cta_button': '立即报名',
    },

    # ─── 页脚配置 ───
    'footer': {
        'brand': '星雨作坊',
        'slogan': '以协作连接灵感，以开源延续成长。',
        'logo': '/logo.png',
        'description': '星雨作坊是一个由学生自主运营的开发社团。我们相信，每一行代码背后都藏着改变世界的力量。',
        'github_url': 'https://github.com/xingyu-studio',
        'email': 'hello@xingyu.studio',
    },

    # ─── 备案信息（页脚展示；工信部要求备案号必须可见且可点击跳转）───
    'icp': {
        'number': '辽ICP备2026023649号',
        'url': 'https://beian.miit.gov.cn/',
        # 公安联网备案：上线后 30 天内在全国互联网安全管理服务平台办理，办好后填入
        'police_number': '',
        'police_url': 'https://beian.mps.gov.cn/',
    },

    # ─── 联系我们页配置 ───
    'contact': {
        'address': '示例大学 计算机学院 实验楼 3 层 星雨作坊工作室',
        'email': 'hello@xingyu.studio',
        'phone': '138-0000-0000',
        'hours': '工作日 18:00-22:00（线上随时可联系）',
        'socials': [
            {'label': 'GitHub', 'url': 'https://github.com/xingyu-studio'},
            {'label': 'Bilibili', 'url': 'https://space.bilibili.com/00000000'},
            {'label': 'Email', 'url': 'mailto:hello@xingyu.studio'},
        ],
    },

    # ─── 主页区域显隐开关 ───
    # 控制首页各模块是否显示，管理员可在后台动态切换
    'sections': {
        'hero_enabled': True,        # Hero 大屏区域
        'about_enabled': True,       # 关于我们
        'members_enabled': True,     # 成员展示
        'projects_enabled': True,    # 项目作品
        'awards_enabled': True,      # 获奖荣誉
        'announcement_enabled': True,  # 公告动态
        'join_enabled': True,        # 加入我们
    },

    # ─── 周报模板 ───
    # 成员端按字段渲染周报表单；AI 分析也按相同字段标签读取内容。
    'weekly_report_template': {
        'title': '周报模板',
        'fields': [
            {
                'key': 'done',
                'label': '本周完成',
                'required': True,
                'placeholder': '本周完成了哪些工作？',
                'rows': 3,
            },
            {
                'key': 'plan',
                'label': '下周计划',
                'required': False,
                'placeholder': '下周计划做什么？',
                'rows': 2,
            },
            {
                'key': 'issues',
                'label': '遇到的问题',
                'required': False,
                'placeholder': '遇到的问题、风险或需要帮助的地方（可选）',
                'rows': 2,
            },
            {
                'key': 'summary',
                'label': '一句话总结',
                'required': False,
                'placeholder': '本周整体进展的一句话总结',
                'rows': 2,
            },
        ],
    },
}

# ────────────────────────────────────────────────────────────────
# 默认 CMS 页面 (Page 表)
# ────────────────────────────────────────────────────────────────
# 这些页面在首次启动时写入 pages 表。
# 每页通过 slug 唯一标识，content 为 JSON 结构，前端根据结构渲染。

DEFAULT_PAGES = {
    # ─── 招新信息页 ───
    # 路径: /recruitment，展示招新要求、流程和常见问题
    'recruitment': {
        'title': '招新信息',
        'content': {
            'intro': '欢迎加入星雨作坊！我们每年春秋两季招新。',
            'requirements': [                                # 申请条件列表
                '对技术有热情，愿意投入时间学习和实践',
                '具备基本的编程能力（不限语言）',
                '良好的团队协作精神',
                '每周能保证至少 6 小时的投入时间',
            ],
            'process': [                                     # 招新流程步骤
                {'step': '在线申请', 'description': '填写申请表，提交个人信息和作品链接'},
                {'step': '笔试筛选', 'description': '根据方向完成对应的笔试题'},
                {'step': '面试交流', 'description': '与团队成员面对面交流'},
                {'step': '试用期', 'description': '为期一个月的试用期，参与实际项目'},
            ],
            'faq': [                                         # 常见问题
                {'question': '我不是计算机专业的学生可以加入吗？',
                 'answer': '当然可以！我们欢迎所有对技术有热情的同学，不限专业。'},
                {'question': '没有项目经验怎么办？',
                 'answer': '没关系，我们会提供学习路径和mentor指导，帮助你快速成长。'},
            ],
        },
    },

    # ─── 新手指南页 ───
    # 路径: /onboarding，帮助新成员快速融入团队
    'onboarding': {
        'title': '新手指南',
        'content': {
            'steps': [
                {'title': '了解社团', 'content': '阅读社团 Wiki，了解我们的文化和项目。'},
                {'title': '配置开发环境', 'content': '根据技术栈文档安装必要的开发工具。'},
                {'title': '选择方向', 'content': '根据兴趣选择前端、后端、设计、算法或产品方向。'},
                {'title': '认领任务', 'content': '在项目看板中认领适合自己的入门任务。'},
                {'title': '参加周会', 'content': '每周参加团队周会，同步进度和交流心得。'},
            ],
        },
    },

    # ─── 雨记协作板页面 ───
    # 路径: /yuji，团队内部协作与知识管理
    'yuji': {
        'title': '雨记协作板',
        'content': {
            'sections': [
                {'title': '知识库', 'body': '团队共享的技术文档和学习资源。'},
                {'title': '项目灵感', 'body': '记录和讨论新的项目创意。'},
                {'title': '会议纪要', 'body': '周会和专题讨论的记录归档。'},
            ],
        },
    },

    # ─── 关于我们页 ───
    # 路径: /about，社团介绍
    'about': {
        'title': '关于我们',
        'content': {
            'body': '星雨作坊是一个由学生自主运营的开发社团。我们相信，每一行代码背后都藏着改变世界的力量。',
            'images': [],
        },
    },

    # ─── 研究方向页 ───
    # 路径: /research，技术方向与学习研究内容
    'research': {
        'title': '研究方向',
        'content': {
            'intro': '星雨作坊围绕五大方向开展学习、研究与项目实践，成员按兴趣选择方向，并在真实项目中持续深耕。',
            'directions': [
                {
                    'name': '前端工程',
                    'tagline': '构建流畅、美观、可访问的用户界面',
                    'techFields': ['React', 'TypeScript', 'Vue', 'Tailwind CSS', 'Web 性能优化'],
                    'content': '研究组件化架构、状态管理、微前端与 Web 动画，打磨复杂产品的前端体验。',
                    'scenarios': ['官网门户', '数据可视化大屏', '小程序 / H5'],
                },
                {
                    'name': '后端服务',
                    'tagline': '设计稳定、可扩展的服务端系统',
                    'techFields': ['Python', 'Flask', 'Go', 'Docker', 'MySQL / Redis'],
                    'content': '研究 REST API 设计、认证授权、消息推送、容器化部署与系统监控。',
                    'scenarios': ['内容管理平台', '智能项目管理', '自动化运维'],
                },
                {
                    'name': '算法与 AI',
                    'tagline': '让机器理解语言、图像与数据',
                    'techFields': ['Python', 'PyTorch', 'NLP', 'CV', '大模型应用'],
                    'content': '研究自然语言处理、计算机视觉与大模型应用（RAG、Agent、智能识别）。',
                    'scenarios': ['证书智能识别', '周报智能分析', '智能问答助手'],
                },
                {
                    'name': '产品设计',
                    'tagline': '把复杂问题翻译成清晰的产品方案',
                    'techFields': ['用户研究', '交互设计', 'Figma', '数据分析'],
                    'content': '研究需求分析、信息架构、界面设计原则与用户增长方法。',
                    'scenarios': ['产品原型', '设计系统', '用户反馈闭环'],
                },
            ],
        },
    },

    # ─── 合作交流页 ───
    # 路径: /cooperation，校企合作、校际交流、学术活动、参会参展
    'cooperation': {
        'title': '合作交流',
        'content': {
            'intro': '星雨作坊积极链接企业、高校与社区，通过合作项目、学术分享与竞赛交流，让成员在真实场景中成长。',
            'items': [
                {
                    'type': '校企合作',
                    'title': '企业联合项目',
                    'description': '与科技公司共建真实项目，企业导师参与评审与指导。',
                    'details': ['企业命题实训', '技术沙龙', '实习内推'],
                },
                {
                    'type': '校际交流',
                    'title': '高校技术交流',
                    'description': '与其他高校学生组织互访，联合开展黑客松与分享会。',
                    'details': ['联合 Hackathon', '跨校技术分享', '社团互访'],
                },
                {
                    'type': '学术活动',
                    'title': '学术讲座与工作坊',
                    'description': '邀请老师、校友与行业专家开展讲座与动手工作坊。',
                    'details': ['技术讲座', '论文共读', '动手工作坊'],
                },
                {
                    'type': '参会参展',
                    'title': '竞赛与展会',
                    'description': '组织参加程序设计、AI 创新等竞赛，并参与创新创业展会。',
                    'details': ['学科竞赛', '创新创业展', '开源大会'],
                },
            ],
        },
    },
}
