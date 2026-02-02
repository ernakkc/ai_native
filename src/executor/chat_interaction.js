const { generateRespond } = require('../skills/chat');
const { getMemoryManager } = require('../utils/memory_manager');
const { createLogger } = require('../utils/logger');
const logger = createLogger('executor.chat_interaction');

/**
 * Handle chat interactions with memory and context awareness
 * @param {Object|String} planOrMessage - Planning result or direct message
 * @param {Function} editMessageCallback - Callback for editing messages
 * @returns {Promise<String>} - AI response
 */
async function chatIterate(planOrMessage, editMessageCallback) {
    logger.info('chatIterate called', { type: typeof planOrMessage });
    
    try {
        let userMessage = '';
        let metadata = {};
        
        // Parse input - could be plan object or direct message string
        if (typeof planOrMessage === 'string') {
            try {
                const parsed = JSON.parse(planOrMessage);
                userMessage = parsed.goal || parsed.summary || planOrMessage;
                metadata = {
                    plan_id: parsed.plan_id,
                    intent: parsed.type
                };
            } catch {
                userMessage = planOrMessage;
            }
        } else if (typeof planOrMessage === 'object') {
            userMessage = planOrMessage.goal || planOrMessage.summary || JSON.stringify(planOrMessage);
            metadata = {
                plan_id: planOrMessage.plan_id,
                intent: planOrMessage.type
            };
        }
        
        logger.info('Processing chat message', { message: userMessage.substring(0, 100) });
        
        // Update status if callback available
        if (typeof editMessageCallback === 'function') {
            await editMessageCallback('💭 Thinking...');
        }
        
        // Generate response with full context (memory is injected in generateRespond)
        const response = await generateRespond(userMessage, editMessageCallback);
        
        logger.info('Chat response generated', { 
            responseLength: response.length,
            truncated: response.substring(0, 100) 
        });
        
        return response;
        
    } catch (error) {
        logger.error('Error in chatIterate', error);
        
        // Return friendly error message
        const errorMessage = `I encountered an error while processing your message. ${error.message || 'Please try again.'}`;
        
        // Still try to save to memory
        try {
            const memoryManager = getMemoryManager();
            await memoryManager.saveConversation({
                userMessage: typeof planOrMessage === 'string' ? planOrMessage : JSON.stringify(planOrMessage),
                aiResponse: errorMessage,
                intentType: 'CHAT_INTERACTION',
                intentCategory: 'ERROR',
                metadata: { error: error.message }
            });
        } catch (memError) {
            logger.error('Failed to save error to memory', memError);
        }
        
        return errorMessage;
    }
}

module.exports = { chatIterate };