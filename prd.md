```markdown
# Echoverse — 互动式 AI 音频叙事引擎

## MVP 产品需求文档 v2.1

---

# 1. 产品概述

## 1.1 产品是什么

Echoverse 是一个基于 Web 的互动音频叙事引擎。用户用自然语言描述一个故事前提，系统生成完全沉浸式的音频体验——包含 AI 旁白（TTS）、动态生成的音效、自适应配乐——并根据用户的实时选择驱动叙事走向。

## 1.2 创新论点

- **turbopuffer** 充当 **"世界记忆"** —— 以向量形式存储故事世界状态用于 RAG 检索、缓存已生成的音频资产以供语义复用、追踪用户偏好画像
- **ElevenLabs** 充当 **"世界声带"** —— Sound Effects API 构建物理音景、Music API 构建情感音景、TTS API 构建叙事语音
- **两者的交汇点是语义音频缓存** —— 用向量相似度判断"是否已经生成过足够相似的声音？"，由此形成**成本飞轮**：更多故事 → 更丰富的缓存 → 更少的 API 调用 → 更低的成本和更快的响应

## 1.3 核心指标

| 指标 | 目标值 |
|------|--------|
| 端到端故事完成 | 用户可以从故事前提 → 经历 3+ 个选择点 → 主动结束或到达结局 |
| 每段音频层数 | ≥ 3 层同时播放（旁白 + 音效 + 配乐） |
| 段落切换延迟 | < 15 秒（含生成）、< 2 秒（缓存命中） |
| 单故事结束时缓存命中率 | > 30% |
| 优雅降级 | 单个音频层失败不会阻塞故事推进 |

## 1.4 项目基本信息

| 条目 | 值 |
|------|-----|
| 版本 | 1.0 MVP |
| 平台 | Web（Next.js 16） |
| 周期 | 6 天 |
| 部署 | Vercel |
| 后端 | 无（Next.js Route Handlers 作为无状态 API 代理） |
| 数据存储 | 纯客户端（localStorage + IndexedDB） |
| 语言 | 英文（默认）+ 中文 |

---

# 2. 设计原则

| 原则 | 说明 |
|------|------|
| **隐私优先** | 所有 API Key 和用户数据留在浏览器。Next.js Route Handlers 是无状态代理——服务端零持久化。 |
| **音频优先** | UI 为音频体验服务。为耳机使用场景设计。视觉元素用于增强沉浸感，而非替代音频。 |
| **必配即用** | 首次使用强制引导配置所有必要 API Key。配置完成后，核心功能即刻可用。 |
| **用户掌控** | 用户随时可结束当前故事，也可以在系统提示结局时选择继续。叙事权归用户。 |
| **飞轮思维** | 每个生成的音频资产都会被向量化并缓存。系统越用越快、越用越便宜。 |

---

# 3. 用户画像

## 3.1 主要用户：故事探索者

**Alex，28 岁，休闲玩家 & 有声书听众**

- 想要互动的、个性化的娱乐体验
- 在通勤或睡前收听
- 能够接受从教程中复制粘贴 API Key
- 重视沉浸感和惊喜，胜过精细控制

## 3.2 次要用户：创意实验者

**Sam，32 岁，独立播客主 & 作者**

- 想要快速原型制作音频叙事
- 通过编辑世界设定来微调氛围
- 可能导出音频用于其他项目
- 关心提示词质量和音频保真度

---

# 4. 用户流程

```
┌──────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│  首次进入 │────▶│  引导配置  │────▶│  创建     │────▶│  加载中    │
│  (检测Key)│     │  (强制)    │     │  故事     │     │  (构建    │
│           │     │  API Keys  │     │  前提     │     │   世界)   │
└──────────┘     └───────────┘     └───────────┘     └───────────┘
                                                           │
                 ┌───────────┐                             ▼
                 │  故事     │     ┌────────────┐    ┌──────────┐
                 │  历史     │◀────│  结局/     │◀───│  播放器   │◀──┐
                 │  /history │     │  主动结束  │    │  (聆听    │   │
                 └───────────┘     └────────────┘    │  +选择)   │   │
                                         │           └──────────┘   │
                                         │  选择"继续故事"          │
                                         └──────────────────────────┘
```

**关键路径：**

1. 首次用户：引导配置（一次性）→ 创建 → 播放 → 选择循环 → 结束/继续
2. 回访用户：首页 → 创建新故事 / 继续旧故事

用户输入故事前提后，应在 **30-60 秒内** 听到第一段音频。

---

# 5. 页面与 UI 规格说明

## 5.1 首次引导流程（Onboarding Wizard）

**触发条件：** `localStorage` 中检测不到已配置的必填 API Key 时，任何页面访问都强制重定向到引导流程。

**表现形式：** 全屏遮罩式引导向导，分步进行。

### 步骤一：欢迎

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              🎭 欢迎来到 Echoverse                    │
│                                                     │
│     在开始你的第一个音频冒险之前，                    │
│     我们需要你提供几个 API Key。                      │
│                                                     │
│     本应用完全在你的浏览器中运行。                    │
│     你的 Key 只会保存在本地，绝不会上传到任何服务器。 │
│                                                     │
│     你需要准备以下服务的 API Key：                    │
│     ✦ LLM 服务（OpenAI 或兼容的 API）                │
│     ✦ ElevenLabs（语音、音效、配乐生成）             │
│     ✦ turbopuffer（向量搜索与语义缓存）              │
│                                                     │
│                  [ 开始配置 → ]                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 步骤二：LLM 配置

```
┌─────────────────────────────────────────────────────┐
│  步骤 1/3 ━━━━━━━━━━━━━○○○○○○○○○○                   │
│                                                     │
│  🧠 配置 LLM 服务                                    │
│                                                     │
│  API 基础地址                                        │
│  ┌───────────────────────────────────────────┐      │
│  │ https://api.openai.com/v1                 │      │
│  └───────────────────────────────────────────┘      │
│  💡 支持任何 OpenAI 兼容的 API 地址                   │
│                                                     │
│  API Key                                             │
│  ┌───────────────────────────────────────────┐      │
│  │ sk-••••••••••••••••••••                    │ 👁    │
│  └───────────────────────────────────────────┘      │
│                                                     │
│  模型名称                                            │
│  ┌───────────────────────────────────────────┐      │
│  │ gpt-4o                                    │      │
│  └───────────────────────────────────────────┘      │
│                                                     │
│  Embedding 模型名称                                  │
│  ┌───────────────────────────────────────────┐      │
│  │ text-embedding-3-small                    │      │
│  └───────────────────────────────────────────┘      │
│                                                     │
│  [ 测试连接 ]  → ✅ 连接成功！                       │
│                                                     │
│            [ ← 返回 ]    [ 下一步 → ]                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 步骤三：ElevenLabs 配置

```
┌─────────────────────────────────────────────────────┐
│  步骤 2/3 ━━━━━━━━━━━━━━━━━━━○○○○○                   │
│                                                     │
│  🎵 配置 ElevenLabs                                  │
│                                                     │
│  API Key                                             │
│  ┌───────────────────────────────────────────┐      │
│  │ xi-••••••••••••••••••••                    │ 👁    │
│  └───────────────────────────────────────────┘      │
│  💡 在 elevenlabs.io/app/settings/api-keys 获取      │
│                                                     │
│  [ 测试连接 ]  → ✅ 连接成功！                       │
│                                                     │
│  ─── 选择默认旁白声音 ───                            │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🔍 搜索声音...                                  │ │
│  ├────────────────────────────────────────────────┤ │
│  │ ○ Rachel    · 女声 · 温暖、平静    [ ▶ 试听 ] │ │
│  │ ● Aria      · 女声 · 富有表现力    [ ▶ 试听 ] │ │
│  │ ○ Roger     · 男声 · 沉稳、自信    [ ▶ 试听 ] │ │
│  │ ○ Charlie   · 男声 · 随性、自然    [ ▶ 试听 ] │ │
│  │ ○ Matilda   · 女声 · 柔和、友好    [ ▶ 试听 ] │ │
│  │ ○ George    · 男声 · 低沉、权威    [ ▶ 试听 ] │ │
│  │ ○ Sarah     · 女声 · 年轻、活力    [ ▶ 试听 ] │ │
│  │ ...                       [ 加载更多 ↓ ]       │ │
│  └────────────────────────────────────────────────┘ │
│  或手动输入 Voice ID: ┌────────────────────┐        │
│                       │                    │        │
│                       └────────────────────┘        │
│                                                     │
│            [ ← 返回 ]    [ 下一步 → ]                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**声音列表获取逻辑：**

1. 测试连接成功后，调用 ElevenLabs `/v1/voices` 接口
2. 返回用户可用的所有声音（含预设 + 用户自建/克隆声音）
3. 展示为可滚动列表，含：名称、性别标签、描述、试听按钮
4. 试听按钮点击后调用 `/v1/text-to-speech/{voice_id}` 生成短句预览（如 "The sun slowly sank behind the distant hills, casting long shadows across the valley."），播放给用户
5. 用户选中一个声音后，将 `voice_id` 存入设置
6. 也支持手动输入 Voice ID（高级用户可能有自己克隆的声音）

### 步骤四：turbopuffer 配置

```
┌─────────────────────────────────────────────────────┐
│  步骤 3/3 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │
│                                                     │
│  🔍 配置 turbopuffer                                 │
│                                                     │
│  API Key                                             │
│  ┌───────────────────────────────────────────┐      │
│  │ tpuf-••••••••••••••••••••                  │ 👁    │
│  └───────────────────────────────────────────┘      │
│  💡 在 turbopuffer.com 控制台获取                     │
│                                                     │
│  API 基础地址（可选，一般无需修改）                   │
│  ┌───────────────────────────────────────────┐      │
│  │ https://api.turbopuffer.com               │      │
│  └───────────────────────────────────────────┘      │
│                                                     │
│  [ 测试连接 ]  → ✅ 连接成功！                       │
│                                                     │
│            [ ← 返回 ]    [ 完成配置 ✓ ]              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 步骤五：配置完成

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              ✅ 一切就绪！                            │
│                                                     │
│     🧠 LLM 服务        ✅ 已连接                    │
│     🎵 ElevenLabs      ✅ 已连接                    │
│     🔍 turbopuffer     ✅ 已连接                    │
│     🗣 旁白声音        ✅ Aria                      │
│                                                     │
│     你的所有配置已安全保存在本地浏览器中。             │
│     随时可以在设置页中修改。                          │
│                                                     │
│           [ 🎧 创建你的第一个故事 → ]                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 引导流程规则

- **强制性：** 三个服务的 API Key 全部必填。每一步的"下一步"按钮仅在"测试连接"通过后启用
- **ElevenLabs 声音选择必选：** 用户必须选择一个声音或手动输入 Voice ID 后才能进入下一步
- **跳出保护：** 未完成配置时关闭/刷新页面，下次打开仍回到引导流程
- **已配置用户：** 配置完成后，后续访问直接进入首页，不再显示引导
- **重新配置：** 设置页提供完整的编辑能力，包括重新选择声音和试听

---

## 5.2 首页

**路由：** `/`

**前置条件：** 所有必填 API Key 已配置（否则重定向到引导流程）

### 布局

- 深色沉浸式背景，配以微妙的 CSS 渐变动画
- Hero 区域：产品名 "Echoverse"，标语 *"描述一个世界，聆听它活过来"*，主 CTA 按钮
- 三列特性展示：
  - 🎭 互动故事 —— "你的选择塑造叙事走向"
  - 🎵 AI 生成音频 —— "每一个声音都为你的故事独家定制"
  - 🧠 自适应引擎 —— "故事会学习你的偏好"
- 快速入门提示："写一个故事前提 → 戴上耳机 → 沉浸在你的故事中"
- 底部最近的故事列表（来自 IndexedDB，如有）

### 条件逻辑

| 条件 | CTA 按钮 |
|------|---------|
| 无历史故事 | "创建你的第一个故事" → `/create` |
| 有历史故事 | "创建新故事" + 最近故事网格 |

### 组件清单

| 组件 | 说明 |
|------|------|
| `HeroSection` | 动画标题、标语、主 CTA 按钮 |
| `FeatureCards` | 3 张卡片：图标 + 标题 + 描述 |
| `RecentStories` | 来自 IndexedDB 的故事卡片网格，支持继续/查看 |

---

## 5.3 设置页

**路由：** `/settings`

**用途：** 修改已配置的 API Key 和用户偏好。所有数据持久化到 `localStorage`。

### API Key 配置

| 字段 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| LLM API 基础地址 | 文本输入 | ✅ | `https://api.openai.com/v1` |
| LLM API Key | 密码输入 | ✅ | — |
| LLM 模型名 | 文本输入 | ✅ | `gpt-4o` |
| Embedding 模型名 | 文本输入 | ✅ | `text-embedding-3-small` |
| ElevenLabs API Key | 密码输入 | ✅ | — |
| turbopuffer API Key | 密码输入 | ✅ | — |
| turbopuffer 基础地址 | 文本输入 | ✅ | `https://api.turbopuffer.com` |

### 声音设置

- 与引导流程步骤三相同的声音选择界面
- 展示当前选中的声音 + 试听按钮
- 可重新选择

### 用户偏好

| 字段 | 类型 | 默认值 |
|------|------|--------|
| 界面语言 | 切换：EN / 中文 | EN |
| 故事语言 | 切换：EN / 中文 | EN |

### 交互行为

- 每个 API Key 配备"测试连接"按钮，行内显示 ✅ / ❌ / ⚠️
- API Key 显示为掩码，配备眼睛图标切换
- **"清除所有数据"** 危险按钮 → 确认弹窗 → 清空 localStorage + IndexedDB → 重回引导流程

### localStorage 数据结构

```json
{
  "echoverse_settings": {
    "llm": {
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "sk-...",
      "model": "gpt-4o",
      "embeddingModel": "text-embedding-3-small"
    },
    "elevenlabs": {
      "apiKey": "xi-..."
    },
    "turbopuffer": {
      "apiKey": "tpuf-...",
      "baseUrl": "https://api.turbopuffer.com"
    },
    "voice": {
      "voiceId": "aria_xxxx",
      "voiceName": "Aria",
      "voiceDescription": "女声 · 富有表现力"
    },
    "preferences": {
      "interfaceLang": "en",
      "storyLang": "en"
    },
    "onboardingCompleted": true
  }
}
```

---

## 5.4 创建故事页

**路由：** `/create`

**用途：** 用户描述故事前提、选择故事元素标签、启动世界生成。

### 布局

#### 故事前提输入

- 大文本框（最少 3 行，自动扩展）："描述你想体验的故事..."
- 占位示例：*"一个宇航员在废弃空间站上独自醒来。她需要修复通讯系统才能呼叫救援，但空间站里似乎还有其他东西..."*

#### 故事元素标签选择

多维度标签选择系统 + 自定义标签。用户可以**跨维度任意组合**，每个维度可选 0 个或多个标签，也可以随意添加自己的标签。

**三个预设维度 + 自定义标签区：**

```
┌─────────────────────────────────────────────────────────────┐
│  选择你的故事元素（可选，多选）                               │
│                                                             │
│  🌍 世界设定                                                │
│  ┌──────┐ ┌──────┐ ┌────┐ ┌──────┐ ┌────────┐ ┌──────┐   │
│  │现代  │ │☑中世 │ │太空│ │末日  │ │维多利亚│ │东方  │   │
│  │都市  │ │ 纪   │ │    │ │废土  │ │  时代  │ │古风  │   │
│  └──────┘ └──────┘ └────┘ └──────┘ └────────┘ └──────┘   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │水下  │ │梦境/ │ │赛博  │ │蒸汽  │ │乡村  │ │热带  │   │
│  │世界  │ │超现实│ │朋克  │ │朋克  │ │田园  │ │丛林  │   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│  ┌──────┐ ┌──────┐                                        │
│  │极地  │ │地下城│                                        │
│  │冰原  │ │      │                                        │
│  └──────┘ └──────┘                                        │
│                                                             │
│  😱 情绪色彩                                                │
│  ┌────┐ ┌──────┐ ┌────┐ ┌────┐ ┌────┐ ┌──────┐ ┌────┐   │
│  │恐怖│ │☑悬疑 │ │热血│ │治愈│ │孤独│ │紧张  │ │忧伤│   │
│  │    │ │      │ │    │ │    │ │    │ │ 刺激 │ │    │   │
│  └────┘ └──────┘ └────┘ └────┘ └────┘ └──────┘ └────┘   │
│  ┌────┐ ┌────┐ ┌──────┐                                   │
│  │诡异│ │欢快│ │平静  │                                   │
│  │    │ │    │ │ 冥想 │                                   │
│  └────┘ └────┘ └──────┘                                   │
│                                                             │
│  👥 主角设定                                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ │
│  │普通人│ │☑侦探 │ │科学家│ │战士│ │孩子│ │老人│ │AI/ │ │
│  │      │ │      │ │      │ │    │ │    │ │    │ │机器│ │
│  └──────┘ └──────┘ └──────┘ └────┘ └────┘ └────┘ └────┘ │
│  ┌────┐ ┌────────┐ ┌────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │动物│ │幽灵/   │ │间谍│ │音乐家│ │流浪者│ │外星人│    │
│  │    │ │ 亡灵   │ │    │ │      │ │      │ │      │    │
│  └────┘ └────────┘ └────┘ └──────┘ └──────┘ └──────┘    │
│                                                             │
│  ✏️ 自定义标签                                              │
│  ┌────────────────────────────────────────┐  ┌──────────┐ │
│  │ 输入自定义标签，按回车添加...           │  │ + 添加   │ │
│  └────────────────────────────────────────┘  └──────────┘ │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────┐       │
│  │☑ 双重人格│ │☑ 时间循环    │ │☑ 不可靠叙述者     │       │
│  │       ✕  │ │          ✕   │ │              ✕    │       │
│  └──────────┘ └──────────────┘ └──────────────────┘       │
│                                                             │
│  ─── 已选标签 ──────────────────────────────────────────── │
│  中世纪 · 悬疑 · 侦探 · 双重人格 · 时间循环              │
│  · 不可靠叙述者                                [清除全部]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**交互规则：**

- 预设标签为 toggle 按钮，点击选中/取消
- 选中标签高亮显示（accent 色边框 + 浅色填充）
- 每个维度默认折叠展示首行（约 7 个），点击维度标题展开全部
- **自定义标签区：**
  - 文本输入框 + "添加"按钮（或按回车键添加）
  - 输入内容不限——任何词组/短语均可作为标签
  - 添加后显示为与预设标签相同样式的 toggle 标签（默认选中），右上角有 ✕ 删除按钮
  - 自定义标签历史：已创建的自定义标签会被记录到 localStorage，下次创建故事时在自定义区域显示（可快速复选），不占预设标签位置
  - 自定义标签不需要归属于任何预设维度——它们是独立的自由标签
- 底部"已选标签"区域实时汇总所有选中标签（含预设 + 自定义），可单独移除或一键清除
- 所有标签完全可选——用户可以不选任何标签，完全靠前提文本驱动

#### 目标时长

```
┌────────────────────────────────────────┐
│  ⏱ 故事时长                            │
│                                        │
│  ○ 短篇（约 5 分钟，3 个选择点）        │
│  ● 中篇（约 15 分钟，5 个选择点）       │
│  ○ 长篇（约 30 分钟，8 个选择点）       │
│                                        │
└────────────────────────────────────────┘
```

### 操作

- **"🎧 开始旅程"** 按钮
  - 点击后进入加载状态：
    - 步骤 1："🌍 正在构建你的世界..."（LLM 世界生成）
    - 步骤 2："🎵 正在调校音景..."（预生成初始音频资产）
    - 步骤 3："✨ 就绪" → 自动跳转到 `/play/[storyId]`
  - 总加载时间：约 15-30 秒

---

## 5.5 故事播放器页 ⭐ 核心 MVP

**路由：** `/play/[storyId]`

**用途：** 主体验页面。沉浸式音频播放 + 互动选择 + 自主结束/继续。

### 布局分区

```
┌─────────────────────────────────────────────────────────────────┐
│ 顶部栏（极简、半透明、播放时自动隐藏）                            │
│ [◀ 退出]  第一章：苏醒    [📝世界] [🗣声音] [🔊音量] [⏹结束故事]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 视觉区域（主区域，约 60% 视口高度）                               │
│                                                                 │
│   全屏氛围 CSS 渐变/动画                                        │
│   根据当前段落情绪切换色彩                                       │
│                                                                 │
│   ┌───────────────────────────────────────────────────────┐    │
│   │  旁白文字（逐字出现，与 TTS 播放同步）                  │    │
│   │                                                       │    │
│   │  "你缓缓睁开双眼。惨白的灯光                           │    │
│   │   刺入瞳孔..."                                        │    │
│   └───────────────────────────────────────────────────────┘    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ 音频层指示器（窄条带）                                           │
│ ~~~~∿∿∿~~~~  🔊音效: 雨声 ┃ 🎵配乐: 氛围 ┃ 🗣旁白中           │
├─────────────────────────────────────────────────────────────────┤
│ 选择区域（旁白结束后从底部滑入）                                  │
│                                                                 │
│ ┌─ 🅰️ 检查电脑终端 ─────────────────────────────────────────┐ │
│ │   "也许日志能解释发生了什么..."                              │ │
│ ├─ 🅱️ 沿走廊走向声音方向 ────────────────────────────────────┤ │
│ │   "是不是有人还活着？"                                      │ │
│ ├─ 🅲️ 尝试修复通讯手环 ─────────────────────────────────────┤ │
│ │   "我得先让别人知道我还活着"                                 │ │
│ ├─ 💬 或者输入你想做的事... ──────────────────────── [执行] ──┤ │
│ └────────────────────────────────────────────────────────────┘ │
│ ⏳ 自动选择倒计时: 0:45                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 组件详细说明

#### 5.5.1 氛围背景 AtmosphericBackground

- 全屏 CSS 渐变 + 微妙动画
- LLM 输出 `mood_color` 字段，映射到渐变预设：

| 情绪 | 渐变色 | 动画 |
|------|--------|------|
| `dread` 恐惧 | #1a0000 → #0a0a0f → #1a0005 | 缓慢脉冲，8 秒 |
| `wonder` 惊奇 | #001a2c → #0a0a1f → #002a2c | 轻柔漂移，12 秒 |
| `tension` 紧张 | #1a1a00 → #0f0a00 → #1a0a00 | 快速脉冲，4 秒 |
| `peace` 平静 | #001a1a → #0a0f1a → #001a2a | 极缓漂移，16 秒 |
| `horror` 恐怖 | #0a0000 → #000000 → #0a0005 | 不规则闪烁 |
| `adventure` 冒险 | #0a1a00 → #1a1a0a → #001a0a | 中速漂移，8 秒 |
| `joy` 欢快 | #1a1a00 → #1a0a1a → #001a1a | 活泼跳动，6 秒 |
| `melancholy` 忧伤 | #0a0a1a → #0a0f1a → #1a0a1a | 缓慢下沉，10 秒 |
| `mystery` 神秘 | #0f001a → #0a0a1f → #1a001a | 缓慢旋转，14 秒 |

- 情绪切换过渡：3 秒 CSS 交叉渐变

#### 5.5.2 旁白显示 NarrationDisplay

- **TTS 模式：** 文字逐词出现，与音频播放大致同步。当前词高亮。
- 字体：衬线字族（`Georgia, 'Noto Serif SC', serif`），字号 18-22px
- 最大宽度：640px，居中

#### 5.5.3 音频层指示器 AudioLayerIndicator

- 窄水平条带（40px）
- 药丸标签展示活跃音频层，每个可点击切换静音
- 微妙波形 CSS 动画背景

#### 5.5.4 选择面板 ChoicePanel

- 旁白结束后从底部滑入
- 2-3 个 LLM 生成的选项卡片（字母标记 + 行动文字 + 提示文字）
- 自由文本输入框
- 倒计时计时器（60 秒默认）
- 键盘快捷键：1/2/3 或 A/B/C

#### 5.5.5 "结束故事"按钮 EndStoryButton

- 位于顶部栏右侧，始终可见
- 点击后确认弹窗 → 确认后 LLM 生成自然结尾段落 → 结局画面

#### 5.5.6 声音切换 VoiceSelector

- 顶部栏 🗣 按钮触发下拉面板
- 展示当前声音 + 可切换列表 + 试听
- 切换后下一段旁白使用新声音

#### 5.5.7 世界编辑器抽屉 WorldEditorDrawer

- 顶部栏 📝 按钮触发，从右侧滑入
- 格式化 JSON + 语法高亮
- 分区：声音 DNA / 角色 / 地点 / 故事约束
- 编辑 → 保存 → 下一段生效
- "重置为初始值"按钮

#### 5.5.8 音量控制 VolumeControl

- 顶部栏 🔊 按钮触发下拉面板
- 滑块：主音量 / 🗣 旁白(100%) / 🔊 音效(70%) / 🎵 配乐(40%)
- 旁白闪避：TTS 激活时配乐降至 60%

#### 5.5.9 加载遮罩 LoadingOverlay

- 段落间显示，分步进度
- 每步 ✅ 完成 / ⚠️ 失败（失败不阻塞）

#### 5.5.10 故事结局画面 StoryEndScreen

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  🎬 「回声空间站」—— 旅程已完成                              │
│                                                             │
│  结局: 「共生」                                              │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  ⏱ 体验时长: 23 分 47 秒                          │    │
│  │  🔀 做出决策: 7 次                                 │    │
│  │  🎵 音频层次: 32 个音效 + 6 段配乐 + 10 段旁白    │    │
│  │  ♻️ 缓存命中: 42%（13 次复用 / 31 次请求）         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  🔄 继续这个故事                                    │    │
│  │  🔁 从头重玩                                       │    │
│  │  📥 导出音频（MP3）                                │    │
│  │  📝 导出文字记录                                   │    │
│  │  📦 导出世界数据（JSON）                           │    │
│  │  🏠 返回首页                                       │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**"继续故事"逻辑：**

1. 点击后 LLM 接收指令：基于当前世界状态和故事结局，开启新的叙事弧线
2. 追加新章节到现有 chapters
3. 恢复正常播放流程
4. 状态从 `completed` 更新回 `playing`

---

## 5.6 故事历史页

**路由：** `/history`

### 布局

- 故事卡片网格（响应式：桌面 3 列、平板 2 列、手机 1 列）
- 每张卡片：标题、标签摘要、进度/完成状态、创建日期、时长
- 操作：继续 / 重玩 / 导出 / 删除

### 导出选项

| 导出类型 | 格式 | 实现方式 |
|---------|------|---------|
| 完整音频 | MP3 | Web Audio API OfflineAudioContext → lamejs 编码 |
| 文字记录 | Markdown | 旁白 + 选择记录 + 时间戳 |
| 世界数据 | JSON | 完整世界状态 |

---

# 6. 功能深度设计

## 6.1 世界生成

### 流程

```
用户故事前提 + 选中的标签（预设+自定义）+ 目标时长
                    │
                    ▼
          ┌─────────────────┐
          │   LLM 调用 #1   │
          │   "构建世界"     │
          └────────┬────────┘
                   │
                   ▼
          结构化 JSON 世界状态
                   │
          ┌────────┴─────────┐
          │                  │
          ▼                  ▼
  保存到 IndexedDB     向量化上传 turbopuffer
```

### LLM 系统提示（世界构建器）

```
你是 Echoverse 的世界构建引擎。给定一个故事前提、元素标签和时长参数，生成一个完整的世界状态 JSON 对象。

用户选择的元素标签：{selected_tags}
（其中包含预设标签和用户自定义标签，请将所有标签都作为世界构建的灵感来源和氛围引导）
目标时长参数：{duration_setting}（short=3 章 / medium=5 章 / long=8 章）

要求：
1. 创建一个丰富、内部一致的世界，适合互动音频叙事
2. 用户的文字描述优先，标签作为氛围和元素引导
3. 自定义标签可能是任何创意概念（如"时间循环""双重人格""不可靠叙述者"），请将其有机融入世界设定
4. 生成 4-8 个地点、2-5 个角色、5-10 个关键物品
5. 定义"声音 DNA"——这个世界的听觉调色板
6. 规划包含 {chapter_count} 章的故事弧线
7. 标记"可发现"的物品/事件

响应格式（严格 JSON）：
{
  "title": "string",
  "genre": "string",
  "tone": "string",
  "setting": {
    "location": "string",
    "era": "string",
    "atmosphere": "string — 2-3 句感官描写"
  },
  "protagonist": {
    "name": "string",
    "role": "string",
    "personality": "string",
    "motivation": "string",
    "wound": "string"
  },
  "characters": [{
    "id": "string",
    "name": "string",
    "role": "string",
    "personality": "string",
    "relationship_to_protagonist": "string",
    "voice_description": "string"
  }],
  "locations": [{
    "id": "string",
    "name": "string",
    "description": "string",
    "atmosphere": "string",
    "connected_to": ["string"],
    "sfx_hints": "string",
    "discoverable_items": ["string"]
  }],
  "items": [{
    "id": "string",
    "name": "string",
    "description": "string",
    "narrative_function": "string",
    "discoverable": true/false
  }],
  "sonic_dna": {
    "palette": ["string — 4-6 个音频纹理描述"],
    "music_style": "string",
    "avoid": ["string"],
    "signature_sound": "string"
  },
  "chapters": [{
    "id": "string",
    "title": "string",
    "summary": "string",
    "target_mood": "string",
    "target_choices": 1-3
  }],
  "story_rules": {
    "story_language": "en/zh",
    "total_target_choices": 3-8
  }
}
```

### 后处理

1. **保存到 IndexedDB**
2. **向量化上传 turbopuffer：** 创建 `dw_{storyId}` 命名空间，实体 embedding + sonic_dna 锚点
3. **预生成初始音频：** 3-5 个环境音效 + 1 段 120s 氛围配乐

---

## 6.2 音频管线

### 段落生成流程

```
用户做出选择（或故事开始）
        │
        ▼
  1. RAG 上下文检索（turbopuffer 向量 + BM25）
        │
        ▼
  2. LLM 叙事生成 → 音频剧本 JSON
        │
        ▼
  3. 音频解析（缓存检查 → 生成 → 写缓存）
        │
        ▼
  4. Web Audio API 多轨混音播放
```

### 步骤 1：RAG 上下文检索

```javascript
// 查询 1：相关世界实体
turbopuffer.query({
  namespace: "dw_{storyId}",
  vector: embed(用户选择 + 当前情境),
  filters: { type: { $in: ["location","character","item","event"] } },
  top_k: 8
})

// 查询 2：玩家决策画像
turbopuffer.query({
  namespace: "dw_{storyId}",
  filters: { type: { $eq: "decision" } },
  top_k: 20
})

// 查询 3：BM25 精确匹配
turbopuffer.query({
  namespace: "dw_{storyId}",
  rank_by: ["BM25", 关键词],
  filters: { type: { $in: ["item","event_trigger"] } },
  top_k: 5
})
```

### 步骤 2：LLM 段落生成

系统提示输出音频剧本 JSON，格式：

```json
{
  "segment_id": "string",
  "chapter": "string",
  "chapter_title": "string",
  "mood_color": "dread|wonder|tension|peace|horror|adventure|joy|melancholy|mystery",
  "emotion_arc": "string",
  "is_ending": false,
  "ending_name": null,
  "narration": {
    "text": "string（故事语言）",
    "voice_style": "string"
  },
  "sfx_layers": [{
    "id": "string",
    "start_sec": 0,
    "description": "string（始终英文）",
    "duration_sec": 15,
    "looping": true,
    "volume": 0.3
  }],
  "music": {
    "description": "string（始终英文）",
    "duration_sec": 60,
    "volume": 0.4,
    "transition": "crossfade_from_previous_4s"
  },
  "state_updates": [{ "entity_id": "string", "updates": {} }],
  "choices": [{
    "id": "string",
    "text": "string",
    "hint": "string",
    "risk": "low|medium|high",
    "unlocks": "string"
  }]
}
```

> `sfx_layers[].description` 和 `music.description` 始终英文（ElevenLabs 兼容性）。`narration.text` 和 `choices` 使用用户选择的故事语言。

### 步骤 3：音频解析

对每个音频层：

```
turbopuffer 向量查询 → score > 阈值？
  ✅ 命中 → 从 IndexedDB 加载 Blob（< 200ms）
  ❌ 未命中 → ElevenLabs 生成 → 存入 IndexedDB + 向量化到 turbopuffer
```

- 音效命中阈值：`> 0.90`
- 配乐命中阈值：`> 0.88`
- TTS 旁白：每段重新生成（内容唯一）

**ElevenLabs API 调用：**

```javascript
// 音效
elevenlabs.text_to_sound_effects.convert({
  text: sfx_layer.description,
  duration_seconds: sfx_layer.duration_sec || null,
  looping: sfx_layer.looping || false,
  prompt_influence: 0.3
})

// 配乐
elevenlabs.music.generate({
  prompt: music.description,
  music_length_ms: music.duration_sec * 1000,
  force_instrumental: true,
  output_format: "mp3_standard"
})

// TTS
elevenlabs.text_to_speech.convert({
  text: narration.text,
  voice_id: 用户选中的 voice_id,
  model_id: "eleven_v3",
  voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.7 }
})
```

### 步骤 4：Web Audio API 混音

```
AudioContext
  └── GainNode（主音量）
        ├── GainNode（旁白 1.0）→ TTS AudioBufferSourceNode
        ├── GainNode（音效 0.7）→ SFX AudioBufferSourceNode × N
        └── GainNode（配乐 0.4）→ Music AudioBufferSourceNode
```

混音行为：旁白闪避（配乐降 60%）、段落交叉渐变（4s）、音效按 start_sec 调度、循环音效段落结束时渐出。

### 降级策略

| 故障 | 处理 |
|------|------|
| 单个音效/配乐失败 | 跳过该层，其他继续 |
| TTS 失败 | 打字机文字动画 |
| 全部 ElevenLabs 失败 | 所有层文字替代，提示检查 Key |
| turbopuffer 失败 | 禁用缓存，全部重新生成 |
| LLM 失败 | 错误 + 重试按钮（唯一硬阻塞） |

---

## 6.3 互动分支

### 选择处理

```
用户做出选择
  ├── 记录到 IndexedDB decisions 表
  ├── 向量化到 turbopuffer（type: decision）
  ├── 应用 state_updates
  └── 触发下一段生成
```

### 自由文本输入

LLM 对自由行动做出合理叙事回应，不简单拒绝，始终推动叙事前进。

### 自动选择（超时 60s）

选最匹配玩家画像的选项；无画像时默认选 A。

### 主动结束

用户点击 [⏹ 结束故事] → 确认 → LLM 生成自然结尾 → 结局画面（可选"继续"）。

---

## 6.4 语义音频缓存

### turbopuffer 命名空间设计

每个故事一个命名空间：`dw_{storyId}`

同一命名空间内用 `type` 属性区分：

| type | 说明 |
|------|------|
| `location` | 地点实体 |
| `character` | 角色实体 |
| `item` | 物品实体 |
| `event_trigger` | 事件触发器 |
| `decision` | 玩家决策记录 |
| `audio_asset` | 音频缓存（sfx / music） |
| `sonic_dna` | 声音 DNA 锚点 |
| `player_profile` | 玩家画像 |

### 缓存命中预期

| 时间点 | 命中率 |
|--------|--------|
| 第 1 段 | ~10% |
| 第 3 段 | ~30% |
| 故事结束 | ~40-50% |

---

## 6.5 用户偏好学习

### 采集：选项风险等级、决策时间、音量调节、自由文本

### 画像：每 3 次决策更新 brave / cautious / empathetic / analytical / scareTolerance 等

### 应用：注入 LLM 提示 → 调整叙事强度、选项风险、惊吓频率

---

## 6.6 导出与存档

- **音频：** OfflineAudioContext 混音 → lamejs → MP3 下载
- **文字：** Markdown（旁白 + 选择 + 时间戳）
- **世界：** JSON（可导入开新故事）

---

# 7. 技术架构

## 7.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        浏览器（客户端）                          │
│                                                                 │
│  Next.js 16 App                                                │
│  页面组件(React 19) ←→ Zustand 状态 ←→ Web Audio 引擎         │
│         │                                                       │
│    服务层 (llm / elevenlabs / turbopuffer)                      │
│         │                                                       │
│    localStorage(设置)  +  IndexedDB(世界/段落/音频/决策)         │
│         │                                                       │
└─────────┼───────────────────────────────────────────────────────┘
          │ Route Handlers 代理（无状态）
    ┌─────┼────────┬───────────────┐
    ▼     ▼        ▼               ▼
  LLM  ElevenLabs  turbopuffer  (外部 API)
```

## 7.2 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 16 (App Router, React 19) |
| 语言 | TypeScript 5.x |
| 样式 | Tailwind CSS 4 |
| 状态管理 | Zustand |
| 本地存储 | idb（IndexedDB wrapper） |
| 音频引擎 | Web Audio API |
| MP3 编码 | lamejs |
| i18n | next-intl |
| 代码高亮 | shiki |
| 部署 | Vercel |
| 图标 | Lucide React |

## 7.3 Route Handlers

### /api/llm/chat

```
POST — Headers: x-llm-base-url, x-llm-api-key, x-llm-model
Body: { messages, temperature?, response_format? }
→ 透传到 {baseUrl}/chat/completions
```

### /api/llm/embeddings

```
POST — Headers: x-llm-base-url, x-llm-api-key, x-embedding-model
Body: { input }
→ 透传到 {baseUrl}/embeddings
```

### /api/elevenlabs/[...path]

```
ALL — Headers: x-elevenlabs-api-key
→ 透传到 https://api.elevenlabs.io/{path}
```

### /api/turbopuffer/[...path]

```
ALL — Headers: x-turbopuffer-api-key, x-turbopuffer-base-url?
→ 透传到 {baseUrl}/{path}
```

---

# 8. 数据模型

## 8.1 IndexedDB

数据库名：`echoverse_db`，版本：1

### stories

```typescript
interface Story {
  id: string;
  title: string;
  genre: string;
  tags: {
    preset: string[];              // 预设标签 ID
    custom: string[];              // 自定义标签文本
  };
  premise: string;
  worldState: WorldState;
  status: 'playing' | 'completed';
  currentChapter: string;
  currentSegmentIndex: number;
  endingName?: string;
  continuedAfterEnding: boolean;
  createdAt: string;
  updatedAt: string;
  totalDurationSec: number;
  totalDecisions: number;
  cacheHitCount: number;
  cacheMissCount: number;
}
```

### segments

```typescript
interface Segment {
  id: string;
  storyId: string;
  chapterId: string;
  audioScript: AudioScript;
  choiceMade?: {
    choiceId: string;
    choiceText: string;
    isFreeText: boolean;
    timestamp: string;
    timeToDecideMs: number;
  };
  audioStatus: {
    tts: 'pending' | 'ready' | 'failed';
    sfx: ('pending' | 'ready' | 'failed')[];
    music: 'pending' | 'ready' | 'failed';
  };
  createdAt: string;
}
```

### audio_assets

```typescript
interface AudioAsset {
  id: string;
  storyId: string;
  category: 'sfx' | 'music' | 'tts';
  description: string;
  audioBlob: Blob;
  durationSec: number;
  looping: boolean;
  mood: string;
  timesUsed: number;
  createdAt: string;
}
```

### decisions

```typescript
interface Decision {
  id: string;
  storyId: string;
  segmentId: string;
  chapterId: string;
  choiceId: string;
  choiceText: string;
  riskLevel: 'low' | 'medium' | 'high';
  traitSignal: string;
  timeToDecideMs: number;
  timestamp: string;
}
```

### player_profile

```typescript
interface PlayerProfile {
  id: 'current';
  storyId: string;
  brave: number;
  cautious: number;
  empathetic: number;
  analytical: number;
  avgDecisionTimeMs: number;
  preferredPacing: 'fast' | 'moderate' | 'slow';
  scareTolerance: 'low' | 'medium' | 'high';
  totalDecisions: number;
  updatedAt: string;
}
```

### custom_tags

```typescript
interface CustomTag {
  id: string;
  text: string;
  createdAt: string;
  usageCount: number;              // 被选用的次数，用于排序展示
}
```

---

# 9. 国际化（i18n）

使用 `next-intl`，支持 EN（默认）+ 中文。

**两层分离：**

- **界面语言** (`interfaceLang`)：UI 文案
- **故事语言** (`storyLang`)：LLM 叙事语言

两者独立设置。

**LLM 提示语言规则：**

- 系统提示始终英文
- `sfx_layers[].description` 和 `music.description` 始终英文
- `narration.text` 和 `choices[].text` 使用 `storyLang`

---

# 10. 错误处理与降级

| 故障 | 处理 |
|------|------|
| 单个音效/配乐失败 | 跳过该层，其他继续 |
| TTS 失败 | 打字机文字动画 |
| 全部 ElevenLabs 失败 | 全部文字替代，提示检查 Key |
| turbopuffer 失败 | 禁用缓存，全部重新生成 |
| LLM JSON 错误 | 重试 1 次 + 默认值填充 |
| LLM 完全失败 | 错误 + 重试按钮（唯一硬阻塞） |
| ElevenLabs 429 | 按 retry-after 等待重试 |
| IndexedDB 写入失败 | 控制台警告，不阻塞 |
| 网络断开 | 尝试播放缓存；否则暂停等待 |
| Web Audio 不可用 | 降级 `<audio>` 标签 |

---

# 11. 六天冲刺计划

## Day 1：基础架构 + 引导流程 + 设置页

- [ ] Next.js 16 项目初始化（TypeScript、Tailwind CSS 4、App Router）
- [ ] 目录结构搭建
- [ ] localStorage / IndexedDB 工具封装（含 custom_tags 表）
- [ ] Route Handlers（`/api/llm/*`、`/api/elevenlabs/*`、`/api/turbopuffer/*`）
- [ ] 引导流程完整实现（5 步 + API Key + 声音选择试听）
- [ ] `/settings` 页面
- [ ] i18n 基础配置
- [ ] 暗色主题

**交付：** 引导配置完成，API 连接通过，声音可试听选择

## Day 2：首页 + 创建故事 + 世界生成

- [ ] `/` 首页（Hero、特性、最近故事）
- [ ] `/create` 页面
  - 文本框 + 3 维度标签选择 + 自定义标签输入/历史
  - 目标时长选择
- [ ] LLM 世界生成器（提示 + 解析 + 校验）
- [ ] 世界状态 → IndexedDB + turbopuffer
- [ ] embedding 服务
- [ ] 加载状态 UI

**交付：** 输入前提 + 标签 → 世界 JSON → 存储成功

## Day 3：核心播放器 + 旁白 + 选择

- [ ] `/play/[storyId]` 框架
- [ ] 氛围背景（9 种情绪映射）
- [ ] LLM 段落生成器（RAG + 提示）
- [ ] 旁白显示（TTS 同步 + 打字机降级）
- [ ] ElevenLabs TTS 集成
- [ ] 选择面板（预设 + 自由文本 + 倒计时 + 快捷键）
- [ ] 段落流转 + 结束故事按钮

**交付：** 可体验完整故事流程（TTS + 互动 + 主动结束）

## Day 4：音效 + 配乐 + 混音引擎

- [ ] ElevenLabs Sound Effects + Music API 集成
- [ ] Web Audio API 混音（多轨 + 闪避 + 渐变 + 时序 + 循环）
- [ ] 音频层指示器 + 音量控制
- [ ] 加载遮罩（分步 + 降级）
- [ ] 全部降级场景处理

**交付：** 完整三层音频体验

## Day 5：语义缓存 + 偏好 + 编辑器

- [ ] 语义音频缓存（turbopuffer 存/查 + IndexedDB Blob）
- [ ] 命中率统计
- [ ] 玩家画像 + LLM 注入
- [ ] 世界编辑器抽屉（JSON 高亮 + 编辑）
- [ ] 声音切换组件
- [ ] 结局画面 + 继续故事

**交付：** 完整一局含缓存、偏好、编辑、结局/继续

## Day 6：导出 + 历史 + 打磨 + 部署

- [ ] `/history` 页面
- [ ] 音频/文字/世界导出
- [ ] i18n 全部文案
- [ ] QA 测试（全功能 + 降级）
- [ ] 响应式布局
- [ ] IndexedDB LRU 清理（> 500MB）
- [ ] README.md
- [ ] Vercel 部署

**交付：** 可公开访问的完整 MVP

---

# 12. 项目目录结构

```
echoverse/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          # 首页
│   ├── settings/page.tsx
│   ├── create/page.tsx
│   ├── play/[storyId]/page.tsx
│   ├── history/page.tsx
│   └── api/
│       ├── llm/
│       │   ├── chat/route.ts
│       │   └── embeddings/route.ts
│       ├── elevenlabs/[...path]/route.ts
│       └── turbopuffer/[...path]/route.ts
├── components/
│   ├── onboarding/
│   │   ├── OnboardingWizard.tsx
│   │   ├── WelcomeStep.tsx
│   │   ├── LlmConfigStep.tsx
│   │   ├── ElevenLabsConfigStep.tsx
│   │   ├── TurbopufferConfigStep.tsx
│   │   ├── CompletionStep.tsx
│   │   └── VoiceSelector.tsx
│   ├── home/
│   │   ├── HeroSection.tsx
│   │   ├── FeatureCards.tsx
│   │   └── RecentStories.tsx
│   ├── settings/
│   │   ├── ApiKeyField.tsx
│   │   ├── TestConnectionButton.tsx
│   │   └── PreferenceSettings.tsx
│   ├── create/
│   │   ├── PremiseInput.tsx
│   │   ├── TagSelector.tsx
│   │   ├── CustomTagInput.tsx
│   │   └── DurationSelector.tsx
│   ├── player/
│   │   ├── AtmosphericBackground.tsx
│   │   ├── NarrationDisplay.tsx
│   │   ├── AudioLayerIndicator.tsx
│   │   ├── ChoicePanel.tsx
│   │   ├── WorldEditorDrawer.tsx
│   │   ├── VolumeControl.tsx
│   │   ├── VoiceSwitcher.tsx
│   │   ├── LoadingOverlay.tsx
│   │   ├── EndStoryButton.tsx
│   │   └── StoryEndScreen.tsx
│   └── history/
│       ├── StoryCard.tsx
│       └── ExportOptions.tsx
├── lib/
│   ├── services/
│   │   ├── llm.ts
│   │   ├── elevenlabs.ts
│   │   └── turbopuffer.ts
│   ├── engine/
│   │   ├── world-generator.ts
│   │   ├── segment-generator.ts
│   │   ├── audio-resolver.ts
│   │   ├── audio-mixer.ts
│   │   ├── player-profile.ts
│   │   └── exporter.ts
│   ├── store/
│   │   ├── settings-store.ts
│   │   ├── story-store.ts
│   │   └── player-store.ts
│   ├── db/
│   │   ├── index.ts
│   │   ├── stories.ts
│   │   ├── segments.ts
│   │   ├── audio-assets.ts
│   │   ├── decisions.ts
│   │   └── custom-tags.ts
│   ├── prompts/
│   │   ├── world-builder.ts
│   │   └── segment-generator.ts
│   ├── constants/
│   │   ├── moods.ts
│   │   ├── story-tags.ts
│   │   └── defaults.ts
│   ├── i18n/
│   │   ├── en.json
│   │   └── zh.json
│   └── utils/
│       ├── local-storage.ts
│       └── audio-utils.ts
├── public/
│   └── favicon.ico
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

# 13. 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| Music API 生成慢（30-90s） | 高 | 段落卡顿 | 当前段播放时后台预生成；缓存命中消除等待 |
| LLM JSON 不稳定 | 中 | 解析失败 | response_format + Zod + 回退 + 重试 |
| IndexedDB 空间不足 | 低 | 存不下 | LRU 清理 > 500MB |
| 声音列表 API 慢 | 中 | 引导卡顿 | 加载态 + localStorage 缓存 |
| 6 天工期紧张 | 高 | 功能不全 | Day 4 前确保核心路径通 |
| 不兼容 LLM API | 中 | 生成失败 | 测试连接提前发现 |

---

# 14. 附录

## 附录 A：ElevenLabs API 端点

| 功能 | 端点 | 方法 |
|------|------|------|
| TTS | `/v1/text-to-speech/{voice_id}` | POST |
| 声音列表 | `/v1/voices` | GET |
| 音效生成 | `/v1/sound-generation` | POST |
| 音乐生成 | `/v1/music/generate` | POST |
| 音乐状态 | `/v1/music/generate/{task_id}` | GET |
| 用户信息 | `/v1/user` | GET |

## 附录 B：turbopuffer API 端点

| 功能 | 端点 | 方法 |
|------|------|------|
| Upsert | `/v1/vectors/{namespace}` | POST |
| Query | `/v1/vectors/{namespace}/query` | POST |
| Delete ns | `/v1/vectors/{namespace}` | DELETE |
| List ns | `/v1/vectors` | GET |

## 附录 C：故事元素标签完整定义

```typescript
export const STORY_TAGS = {
  world: {
    label: { en: "World Setting", zh: "世界设定" },
    icon: "🌍",
    options: [
      { id: "modern_city", label: { en: "Modern City", zh: "现代都市" } },
      { id: "medieval", label: { en: "Medieval", zh: "中世纪" } },
      { id: "space", label: { en: "Space", zh: "太空" } },
      { id: "post_apocalyptic", label: { en: "Post-Apocalyptic", zh: "末日废土" } },
      { id: "victorian", label: { en: "Victorian Era", zh: "维多利亚时代" } },
      { id: "east_asian_ancient", label: { en: "East Asian Ancient", zh: "东方古风" } },
      { id: "underwater", label: { en: "Underwater World", zh: "水下世界" } },
      { id: "dreamscape", label: { en: "Dreamscape / Surreal", zh: "梦境/超现实" } },
      { id: "cyberpunk", label: { en: "Cyberpunk", zh: "赛博朋克" } },
      { id: "steampunk", label: { en: "Steampunk", zh: "蒸汽朋克" } },
      { id: "rural_pastoral", label: { en: "Rural Pastoral", zh: "乡村田园" } },
      { id: "tropical_jungle", label: { en: "Tropical Jungle", zh: "热带丛林" } },
      { id: "arctic", label: { en: "Arctic", zh: "极地冰原" } },
      { id: "dungeon", label: { en: "Underground / Dungeon", zh: "地下城" } },
    ]
  },
  mood: {
    label: { en: "Emotional Tone", zh: "情绪色彩" },
    icon: "😱",
    options: [
      { id: "horror", label: { en: "Horror", zh: "恐怖" } },
      { id: "suspense", label: { en: "Suspense", zh: "悬疑" } },
      { id: "passionate", label: { en: "Passionate", zh: "热血" } },
      { id: "healing", label: { en: "Healing", zh: "治愈" } },
      { id: "lonely", label: { en: "Lonely", zh: "孤独" } },
      { id: "thrilling", label: { en: "Thrilling", zh: "紧张刺激" } },
      { id: "melancholic", label: { en: "Melancholic", zh: "忧伤" } },
      { id: "eerie", label: { en: "Eerie", zh: "诡异" } },
      { id: "cheerful", label: { en: "Cheerful", zh: "欢快" } },
      { id: "meditative", label: { en: "Meditative", zh: "平静冥想" } },
    ]
  },
  protagonist: {
    label: { en: "Protagonist", zh: "主角设定" },
    icon: "👥",
    options: [
      { id: "ordinary_person", label: { en: "Ordinary Person", zh: "普通人" } },
      { id: "detective", label: { en: "Detective", zh: "侦探" } },
      { id: "scientist", label: { en: "Scientist", zh: "科学家" } },
      { id: "warrior", label: { en: "Warrior", zh: "战士" } },
      { id: "child", label: { en: "Child", zh: "孩子" } },
      { id: "elderly", label: { en: "Elderly", zh: "老人" } },
      { id: "ai_robot", label: { en: "AI / Robot", zh: "AI/机器人" } },
      { id: "animal", label: { en: "Animal", zh: "动物" } },
      { id: "ghost", label: { en: "Ghost / Undead", zh: "幽灵/亡灵" } },
      { id: "spy", label: { en: "Spy", zh: "间谍" } },
      { id: "musician", label: { en: "Musician", zh: "音乐家" } },
      { id: "wanderer", label: { en: "Wanderer", zh: "流浪者" } },
      { id: "alien", label: { en: "Alien", zh: "外星人" } },
    ]
  }
} as const;
```

## 附录 D：自定义标签系统设计

### 数据流

```
用户输入自定义标签文本
  → 按回车或点击"添加"
  → 创建 CustomTag 记录到 IndexedDB
  → 标签自动选中，加入已选列表
  → 创建故事时，所有选中标签（预设+自定义）打包传入 LLM

LLM 系统提示中的标签处理：
  预设标签: ["medieval", "suspense", "detective"]
  自定义标签: ["双重人格", "时间循环", "不可靠叙述者
```
