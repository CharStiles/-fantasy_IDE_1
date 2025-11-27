# Fantasy IDE 🎨✨

These are a series of experiments with reimagining the creative coding IDE.
This verion has bi-directional programming, with a javascript represention and a visual graphical representation. It has an AI tile that can augment the code as well as critique it. Other graphical integrations are webGL, webGPU and windowing/webcam input

font in the IDE is by Clara Sambot from https://velvetyne.fr/fonts/cirruscumulus/

## Updates 🎪

You can read more about roadmap and updates at [charstiles.github.io/loading/](https://charstiles.github.io/loading/)

## Quick Start 🚀

1. Clone this repository:
```bash
git clone https://github.com/CharStiles/-fantasy_IDE_1.git
cd -fantasy_IDE_1
```

2. Install :
```bash
npm install
```

3. (optional to use AI components) Create your `.env` file :
```
# Provider configuration
AI_PROVIDER=openai

# OpenAI configuration (default)
OPENAI_API_KEY=your_openai_key
OPENAI_ORG_ID=your_org_id

# Ollama configuration
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama2

# Or specify custom models
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4
```

4. Start:
```bash
npm run dev:all
```

## Features 🚀

### Shader Diff System
- **Automatic Diff Saving**: Every successful shader compilation is automatically saved as a diff
- **Diff Visualization**: Click the "📊 Diff History" button to view a tree of all shader changes
- **AI Summaries**: Each diff includes an AI-generated summary of what changed (requires OpenAI API key)
- **Load Previous Versions**: Click any diff to load that version of the shader back into the editor
- **Cleanup**: Diffs are automatically minimized when shaders are minimized

### How to Use the Diff System
1. Create or edit a WebGL/WebGPU node
2. Make changes to your shader code
3. When the shader compiles successfully, a diff is automatically saved
4. Click the "📊 Diff History" button in the toolbar to view all diffs
5. Click on any diff to see details and load that version
6. Use the Load/Delete buttons to manage your shader history

## Stack 

- Frontend: TypeScript
- Backend: Express, TypeScript
- Code Editor: CodeMirror
- Real-time: Socket.IO
- AI Integration: OpenAI API (for diff summaries)

## Join

Feel free to:
- Submit ideas for new features
- Report bugs
- Contribute code
- Share your experiences using Fantasy IDE (find me online at @charstiles)

## License 📜

This project is licensed under the MIT License - see the LICENSE file for details.

