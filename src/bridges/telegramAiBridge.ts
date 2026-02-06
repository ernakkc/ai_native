import { startAiProcessing } from '../brain/ProcessController.js';

/**
 * Bridge function to process Telegram messages with AI.
 * @param bot - The Telegram bot instance.
 * @param ctx - The context object from the Telegram bot.
 * @returns {Promise<string>} - The AI-generated response.
 */
async function telegramAiBridge(bot: any, ctx: any): Promise<string> {
    const userMessage = ctx.message.text;

    const aiResponse = await startAiProcessing(bot, ctx);

    return aiResponse;
}

export { telegramAiBridge }