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
            if (typeof aiResponse === 'object') {
                await ctx.reply('```json\n' + JSON.stringify(aiResponse, null, 2) + '\n```', { parse_mode: 'Markdown' });
            } else {
                await ctx.reply(`${aiResponse}`);
            }

        } catch (error) {
            logger.error('AI Bridge Error:', error);
            await ctx.reply('⚠️ An error occurred: ' + (error.message || error));
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