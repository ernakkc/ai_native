import { ANALYZER_SYSTEM_PROMPT } from '../prompts/MessageAnalyzerPrompt.js';
import { AnalysisResult } from '../prompts/MessageAnalyzerPrompt.js';   
import { generateAiResponse } from '../../skills/ai.js';




async function analyzeMessage(message:string): Promise<AnalysisResult> {
    const systemPrompt = ANALYZER_SYSTEM_PROMPT;
    const userPrompt = message;

    const aiResponse = await generateAiResponse(systemPrompt, userPrompt);
    return aiResponse;
}


export { analyzeMessage }