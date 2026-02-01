const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const { telegramMessageBridge } = require('../../bridges/telegram2ai'); 
require('dotenv').config();
const { createLogger } = require('../../utils/logger');
const logger = createLogger('interfaces.telegram.bot');

// Check for TELEGRAM_API_KEY in .env
if (!process.env.TELEGRAM_API_KEY) {
    throw new Error("❌ ERROR: TELEGRAM_BOT_TOKEN not found in .env!");
}

const bot = new Telegraf(process.env.TELEGRAM_API_KEY);

// For security, let's get the Admin ID from .env (Optional but recommended)
const ADMIN_ID = process.env.ADMIN_ID;

// Telegram message limit is 4096 characters
const TELEGRAM_MESSAGE_LIMIT = 4096;

/**
 * Split long message into chunks that fit Telegram's character limit
 * @param {String} text - Long text to split
 * @param {Number} maxLength - Maximum length per chunk (default: 4000 to leave room for formatting)
 * @returns {Array<String>} - Array of message chunks
 */
function splitMessage(text, maxLength = 4000) {
    if (text.length <= maxLength) {
        return [text];
    }

    const chunks = [];
    let currentChunk = '';
    const lines = text.split('\n');

    for (const line of lines) {
        // If a single line is longer than maxLength, split it by characters
        if (line.length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = '';
            }
            
            // Split long line into character chunks
            for (let i = 0; i < line.length; i += maxLength) {
                chunks.push(line.substring(i, i + maxLength));
            }
            continue;
        }

        // If adding this line exceeds limit, save current chunk and start new one
        if (currentChunk.length + line.length + 1 > maxLength) {
            chunks.push(currentChunk);
            currentChunk = line;
        } else {
            currentChunk += (currentChunk ? '\n' : '') + line;
        }
    }

    // Add remaining chunk
    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
} 

async function startTelegramBot() {
    logger.info('startTelegramBot initialized');
    
    // 1. SECURITY LAYER (Middleware)
    // Runs on every message. Rejects if the sender is not you.
    bot.use(async (ctx, next) => {
        logger.info('Incoming message from', ctx.from.id, ctx.from.username);
        if (ADMIN_ID && ctx.from.id.toString() !== ADMIN_ID) {
            logger.warn('Unauthorized access attempt', ctx.from.id, ctx.from.first_name);
            return ctx.reply("⛔ This bot is a private protocol. You do not have access.");
        }
        await next();
    });

    // 2. Start Command
    bot.start(async (ctx) => {
        logger.info('Received /start from', ctx.from.id);
        await ctx.reply(`Welcome ${ctx.from.first_name}. AI NATIVE Protocol is active. Awaiting your commands.`);
    });

    // 3. Message Listener
    bot.on(message('text'), async (ctx) => {
        const userMessage = ctx.message.text;
        logger.info('Handling text message', { from: ctx.from.id, text: userMessage });

        try {
            // Send "Thinking..." action and initial bot-owned status message
            await ctx.sendChatAction('typing');
            const statusMsg = await ctx.reply('Processing...');

            // Create a safe edit callback that edits the bot-owned status message
            const editMessageCallback = async (newText) => {
                try {
                    await ctx.telegram.editMessageText(statusMsg.chat.id, statusMsg.message_id, null, newText);
                } catch (err) {
                    logger.warn('Could not edit status message, falling back to reply', err.message);
                    await ctx.reply(newText);
                }
            };

            // Send to bridge and wait for response
            const aiResponse = await telegramMessageBridge(userMessage, editMessageCallback);

            // Write the response back to Telegram
            let responseText;
            if (typeof aiResponse === 'object') {
                responseText = '```json\n' + JSON.stringify(aiResponse, null, 2) + '\n```';
            } else {
                responseText = String(aiResponse);
            }

            // Split long messages into chunks
            const messageChunks = splitMessage(responseText);
            
            if (messageChunks.length === 1) {
                // Single message, send as usual
                if (typeof aiResponse === 'object') {
                    await ctx.reply(messageChunks[0], { parse_mode: 'Markdown' });
                } else {
                    await ctx.reply(messageChunks[0]);
                }
            } else {
                // Multiple chunks, send each as separate complete message
                logger.info(`Splitting long response into ${messageChunks.length} messages`);
                
                for (let i = 0; i < messageChunks.length; i++) {
                    await ctx.reply(messageChunks[i]);
                    
                    // Small delay between messages to avoid rate limiting
                    if (i < messageChunks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }
            }

        } catch (error) {
            logger.error('AI Bridge Error:', error);
            const errorMessage = '⚠️ An error occurred: ' + (error.message || error);
            
            // Split error message if too long
            const errorChunks = splitMessage(errorMessage);
            for (const chunk of errorChunks) {
                await ctx.reply(chunk);
            }
        }
    });

    // 4. Start the Bot (Non-blocking)
    // We don't use await here, so index.js continues running.
    bot.launch({
        polling: {
            // Bağlantı kopsa bile tekrar dene
            allowedUpdates: ['message', 'callback_query'], 
        }
    })
    .then(() => {
        logger.info('✅ TELEGRAM BAĞLANTISI BAŞARILI');
    })
    .catch((err) => {
        logger.error('❌ TELEGRAM BAĞLANTI HATASI:', err.message);
        // Hata olsa bile process'i kapatma, belki internet geri gelir
    });

    // Graceful Stop (Shutdown signals)
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}


module.exports = { startTelegramBot };