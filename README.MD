# Fantasy IDE 🎨✨

These are a series of experiments with reimagining the creative coding IDE.
This verion has bi-directional programming, with a javascript represention and a visual graphical representation. It has an AI tile that can augment the code as well as critique it. Other graphical integrations are webGL, webGPU and windowing/webcam input

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

## Tech Stack 🧙‍♂️

- Frontend: TypeScript
- Backend: Express, TypeScript
- Code Editor: CodeMirror
- Real-time: Socket.IO

## Join the Adventure! 🎨

Feel free to:
- Submit ideas for new features
- Report bugs
- Contribute code
- Share your experiences using Fantasy IDE (find me online at @charstiles)

## License 📜

This project is licensed under the MIT License - see the LICENSE file for details.

