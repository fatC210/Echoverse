# Echoverse

[🇺🇸 English](./README.md)

Echoverse 是一个基于 Web 的沉浸式 AI 音频叙事引擎。用户输入故事前提，系统会生成世界设定、叙事段落、旁白语音、音效和配乐，并根据用户的选择继续推进剧情。

## ✨ 核心能力

### 1. 故事前提生成

- 支持预设标签和自定义标签组合
- 支持中英文前提生成
- 会主动避免连续生成过于相似的前提

### 2. 互动叙事推进

- 根据当前世界状态、历史片段、玩家决策和检索上下文生成下一段故事
- 支持正常推进、主动结束、结局后继续等模式
- 记录玩家决策时间、风险倾向和画像变化

### 3. 多层音频体验

- 旁白使用 ElevenLabs TTS 生成
- 音效和配乐由 ElevenLabs 音频能力生成
- 播放器支持旁白、音效、音乐单独静音和总音量调节

### 4. 语义记忆与缓存

- `turbopuffer` 用于存储世界元素、玩家画像、决策记录和音频资产语义信息
- 使用 embedding 做世界检索，辅助后续段落生成
- 对音效与配乐做语义相似缓存匹配，降低重复生成成本

### 5. 浏览器本地持久化

- 用户配置保存在 `localStorage`
- 故事、片段、音频资产、自定义标签保存在 `IndexedDB`
- 支持故事历史查看、继续游玩、删除和导出

推荐体验路径：

1. 打开设置页并完成外部服务配置。
2. 选择 ElevenLabs 可用声音作为默认旁白。
3. 在创建页生成故事前提并开始故事。
4. 在播放器中听旁白、做选择、继续分支推进。
5. 在历史页导出故事记录、世界 JSON 或 MP3。

## 🔌 外部依赖

项目运行依赖以下外部服务：

- OpenAI 兼容的 LLM 服务
- ElevenLabs
- turbopuffer

## 🚀 本地部署

### 1. 安装依赖

项目同时存在 `package-lock.json` 和 `bun.lock`，可以使用 `npm` 或 `bun`。

```bash
npm install
```

或

```bash
bun install
```

### 2. 构建应用

```bash
npm run build
```

### 3. 启动本地服务

```bash
npm run start
```

### 4. 完成应用内配置

打开 `http://localhost:3000`，然后进入 `/settings` 填写：

- LLM Base URL、API Key、Chat Model、Embedding Model
- ElevenLabs API Key 和默认 Voice ID
- turbopuffer API Key

配置完成后，即可按正常流程创建故事并开始体验。