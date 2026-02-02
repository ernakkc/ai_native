const { runAI } = require('../skills/ai');
const { ANALYZER_SYSTEM_PROMPT } = require('../../data/prompts/MessageAnalyzerPrompt');
const { injectSystemContext } = require('../utils/system_context');
const { getMemoryManager } = require('../utils/memory_manager');
const { createLogger } = require('../utils/logger');
const logger = createLogger('brain.analyzer');


const analyzeMessage = async (message) => {
    logger.info('analyzeMessage called', { message });
    
    // Inject system context and memory into the prompt
    const systemPrompt = await injectSystemContext(ANALYZER_SYSTEM_PROMPT, { 
        position: 'end',
        compact: false,
        includeMemory: true
    });
    
    const response = await runAI(message, systemPrompt);
    logger.info('analyzeMessage response', response);
    
    // Extract and save insights from the message
    const memoryManager = getMemoryManager();
    await memoryManager.extractInsights(message, response);
    
    return response;
}

module.exports = { analyzeMessage };
