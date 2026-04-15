# Echoverse

[🇨🇳 中文说明](./README.zh.md)

Echoverse is a web-based immersive AI audio narrative engine. Users input a story premise, and the system generates the world setting, narrative passages, voiceover, sound effects, and background music, then continues the story based on user choices.

## ✨ Core Features

### 1. Story Premise Generation

- Supports both preset and custom tags
- Supports premise generation in both Chinese and English
- Actively avoids generating highly similar premises consecutively

### 2. Interactive Narrative Advancement

- Generates the next story segment based on the current world state, story history, player decisions, and retrieved context
- Supports normal progression, proactive ending, and post-ending continuation
- Tracks player choice time, risk tendency, and profile changes

### 3. Layered Audio Experience

- Generates voiceover using ElevenLabs TTS
- Uses ElevenLabs audio capabilities for sound effects and music
- Player supports muting and independent volume controls for voiceover, sound effects, and music

### 4. Semantic Memory and Caching

- `turbopuffer` stores semantic info for world elements, player profile, decision records, and audio assets
- Embeddings are used for world retrieval to assist with subsequent narrative generation
- Sound effects and music benefit from semantic similarity cache matching to reduce redundant generation

### 5. Browser Local Persistence

- User settings are stored in `localStorage`
- Stories, fragments, audio assets, and custom tags are stored in `IndexedDB`
- Supports viewing story history, continuing, deleting, and exporting

Recommended Experience Flow:

1. Open the settings page and complete external service configuration.
2. Select an available ElevenLabs voice as the default narrator.
3. Generate a story premise and start your story from the creation page.
4. Listen to the narration, make choices, and continue the branches in the player.
5. Export story records, world JSON, or MP3 from the history page.

## 🔌 External Dependencies

The project requires the following external services to run:

- OpenAI-compatible LLM service
- ElevenLabs
- turbopuffer

## 🚀 Local Deployment

### 1. Install Dependencies

Both `package-lock.json` and `bun.lock` are present, so you may use either `npm` or `bun`.

```bash
npm install
```

or

```bash
bun install
```

### 2. Build the Application

```bash
npm run build
```

### 3. Start the Local Server

```bash
npm run start
```

### 4. Complete In-App Configuration

Open `http://localhost:3000`, then go to `/settings` and fill in:

- LLM Base URL, API Key, Chat Model, Embedding Model
- ElevenLabs API Key and default Voice ID
- turbopuffer API Key

Once configuration is complete, you can create stories and start your experience as usual.