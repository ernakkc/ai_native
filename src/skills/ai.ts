import { Ollama } from 'ollama';
import { config } from '../config.js';
import { AnalysisResult } from '../brain/prompts/MessageAnalyzerPrompt.js';

async function generateAiResponse(systemPrompt: string, prompt: string, options: Record<string, any> = {}): Promise<AnalysisResult> {
    const ollama = new Ollama({
        host: `http://localhost:${config.ai.ollamaPort}`
    })

    const systemContent = typeof systemPrompt === 'string' ? systemPrompt : JSON.stringify(systemPrompt);
    const userContent = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

    const requestConfig: any = {
        model: config.ai.modelName,
        messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent }
        ],
        stream: false,
        temperature: 0.7
    };

    if (options.expectedJson !== false) {
        requestConfig.format = 'json';
    }

    const response: any = await ollama.chat(requestConfig);

    if (options.expectedJson !== false) {
        try {
            const raw = response?.message?.content;
            const result = (typeof raw === 'string') ? JSON.parse(raw) : raw;
            return result;
        } catch (error) { return response?.message?.content; }
    } else {
        return response?.message?.content;
    }
}

export { generateAiResponse }