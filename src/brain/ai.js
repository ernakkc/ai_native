const { Ollama } = require('ollama');
require('dotenv').config();
const { createLogger } = require('../utils/logger');
const logger = createLogger('brain.ai');


async function runAI(userMessage, constantPrompt){
    logger.info('runAI called');
    const ollama = new Ollama({
        host: process.env.OLLAMA_PORT ? `http://localhost:${process.env.OLLAMA_PORT}` : 'http://localhost:11434'
    });

    try {
        // Ensure message contents are strings (Ollama expects string content)
        const systemContent = typeof constantPrompt === 'string' ? constantPrompt : JSON.stringify(constantPrompt);
        const userContent = typeof userMessage === 'string' ? userMessage : JSON.stringify(userMessage);

        logger.debug('Ollama chat request', { model: process.env.OLLAMA_MODEL || 'llama3' });
        const response = await ollama.chat({
            model: process.env.OLLAMA_MODEL || 'llama3',
            format: 'json',
            messages: [
                { role: 'system', content: systemContent },
                { role: 'user', content: userContent }
            ],
            stream: false
        });

        // Gelen yanıtı parse et (response.message.content bazen string olabilir veya zaten objedir)
        const raw = response?.message?.content;
        const result = (typeof raw === 'string') ? JSON.parse(raw) : raw;
        logger.info('runAI result', result);
        return result;

    } catch (error) {
        logger.error('Analyzer Error:', error);
        // Hata durumunda güvenli bir fallback (yedek) dönüş
        return { 
            type: "CHAT_INTERACTION", 
            summary: "Error in analysis", 
            confidence: 0 
        };
    }
}


module.exports = { runAI };
