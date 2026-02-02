const { runAI } = require("./ai.js");    
const { CHAT_SYSTEM_PROMPT } = require("../../data/prompts/prompt_chat.js");    
const { injectSystemContext } = require('../utils/system_context');
const { getMemoryManager } = require('../utils/memory_manager');
const { createLogger } = require('../utils/logger');
const logger = createLogger('skills.chat');

/**
 * Generate AI response for chat interactions with full context
 * @param {String} message - User message
 * @param {Function} editMessageCallback - Callback for status updates
 * @returns {Promise<String>} - AI response
 */
async function generateRespond(message, editMessageCallback) {
    logger.info('generateRespond called', { messageLength: message.length });
    
    try {
        // Prepare enhanced system prompt with system info and memory
        const enhancedPrompt = await injectSystemContext(CHAT_SYSTEM_PROMPT, {
            position: 'end',
            compact: false,
            includeMemory: true
        });
        
        logger.debug('System prompt prepared', { promptLength: enhancedPrompt.length });
        
        // Generate AI response - DON'T use JSON format for chat!
        const response = await runAI(message, enhancedPrompt, { expectJson: false });
        
        // Validate response
        if (!response || response.trim().length === 0) {
            logger.warn('Empty response from AI');
            return "I'm having trouble formulating a response. Could you rephrase that?";
        }
        
        // Extract insights from the conversation
        const memoryManager = getMemoryManager();
        await memoryManager.extractInsights(message);
        
        logger.info('Response generated successfully', { 
            responseLength: response.length,
            preview: response.substring(0, 80) 
        });
        
        return response.trim();
        
    } catch (error) {
        logger.error('Error generating response', error);
        
        // Return user-friendly error
        if (error.message.includes('ECONNREFUSED')) {
            return "I'm having trouble connecting to the AI service. Please ensure Ollama is running.";
        } else if (error.message.includes('timeout')) {
            return "The request took too long. Please try a simpler question or check your connection.";
        } else {
            return `I encountered an error: ${error.message}. Please try again.`;
        }
    }
};

module.exports = { generateRespond };