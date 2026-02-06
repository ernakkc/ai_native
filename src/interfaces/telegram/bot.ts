import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { config } from '../../config.js' 

import { isUserAuthorized } from './helpers/check_auth.js';
import { editMessage } from './helpers/editMessage.js';
import { sendMessage } from './helpers/sendMessage.js';
import { addCallbackQuery, getCallbackQuery } from './callback_query.js';

import { telegramAiBridge } from '../../bridges/telegramAiBridge.js';

const bot = new Telegraf(config.telegram.token);

/**
 * Start the Telegram bot and set up message handling.
 */
async function startTelegramBot() {

    // Handle the /start command
    bot.start(async (ctx) => {
        const userId = ctx.from?.id;
        if (userId && await isUserAuthorized(userId)) {
            await ctx.reply('Welcome to the  AI NATIVE Project. Im waiting your commands!');
        } else {
            await ctx.reply('Unauthorized access. You are not allowed to use this bot.');
        }
    });

    // Handle text messages
    bot.on(message('text'), async (ctx) => {
        const userId = ctx.from?.id;
        if (!(userId && await isUserAuthorized(userId))) {
            await ctx.reply('Unauthorized access. You are not allowed to use this bot.');
            return;
        }

        const chatId = ctx.chat.id;
        const messageId = ctx.message.message_id;
        const userMessage = ctx.message.text;

        const aiResponse = await telegramAiBridge(bot, ctx);
        await sendMessage(bot, chatId, aiResponse);
    });

    // Handle callback queries
    bot.on('callback_query', async (ctx) => {
        const user = ctx.from.id;
        if (!(user && await isUserAuthorized(user))) {
            await ctx.answerCbQuery('Unauthorized access. You are not allowed to use this bot.');
            return;
        }
        await addCallbackQuery(ctx);
        await ctx.answerCbQuery('Callback query received.');
        await ctx.reply(`You clicked: ${await getCallbackQuery(ctx.callbackQuery.message?.message_id || 0)}`);
    });
    



    // Launch the bot
    await bot.launch();
    console.log('Telegram bot started.');
}


export { startTelegramBot }