const { Ollama } = require('ollama');
require('dotenv').config();
const { createLogger } = require('../utils/logger');
const logger = createLogger('brain.ai');


async function runAI(userMessage, constantPrompt, options = {}){
    logger.info('runAI called', { expectJson: options.expectJson !== false });
    const ollama = new Ollama({
        host: process.env.OLLAMA_PORT ? `http://localhost:${process.env.OLLAMA_PORT}` : 'http://localhost:11434'
    });

    try {
        // Ensure message contents are strings (Ollama expects string content)
        const systemContent = typeof constantPrompt === 'string' ? constantPrompt : JSON.stringify(constantPrompt);
        const userContent = typeof userMessage === 'string' ? userMessage : JSON.stringify(userMessage);

        logger.debug('Ollama chat request', { model: process.env.OLLAMA_MODEL || 'llama3' });
        
        // Prepare request - only add format: 'json' if expectJson is true (default)
        const requestConfig = {
            model: process.env.OLLAMA_MODEL || 'llama3',
            messages: [
                { role: 'system', content: systemContent },
                { role: 'user', content: userContent }
            ],
            stream: false
        };
        
        // Add JSON format only for structured responses (analysis, planning)
        if (options.expectJson !== false) {
            requestConfig.format = 'json';
        }
        
        const response = await ollama.chat(requestConfig);

        // Parse response based on expectJson flag
        if (options.expectJson !== false) {
            // Gelen yanıtı parse et (response.message.content bazen string olabilir veya zaten objedir)
            try {
                const raw = response?.message?.content;
                const result = (typeof raw === 'string') ? JSON.parse(raw) : raw;
                logger.info('runAI result (JSON)', result);
                return result;
            } catch (parseError) {
                logger.warn('Failed to parse JSON response', parseError);
                return response?.message?.content;
            }
        } else {
            // For chat responses, return plain text
            const result = response?.message?.content;
            logger.info('runAI result (text)', { length: result?.length });
            return result;
        }


    } catch (error) {
        logger.error('Analyzer Error:', error);
        // Hata durumunda güvenli bir fallback (yedek) dönüş
        if (options.expectJson !== false) {
            return { 
                type: "CHAT_INTERACTION", 
                summary: "Error in analysis", 
                confidence: 0 
            };
        } else {
            return "I encountered an error processing your request. Please try again.";
        }
    }
}


module.exports = { runAI };
