/** 
 * Send Message Helper Function
 * @param {Object} bot - The Telegram bot instance.
 * @param {Number} chatId - The chat ID where the message will be sent.
 * @param {String} text - The text content of the message.
 * @param {Object} options - Optional parameters (parse_mode, reply_markup, etc.)
 * @returns {Promise<Object>} - The sent message object.
 */ 
async function sendMessage(bot: any, chatId: number, text: string, options: any = {}): Promise<any> {    
    try {
        await bot.telegram.sendChatAction(chatId,'typing')
        
        // Eğer text'te JSON varsa veya özel karakterler içeriyorsa, Markdown kullanma
        const shouldUseMarkdown = options.parse_mode !== false && !text.includes('{') && !text.includes('```');
        
        const sentMessage = await bot.telegram.sendMessage(
            chatId, 
            text, 
            {
                ...options,
                parse_mode: shouldUseMarkdown ? 'Markdown' : undefined,
            }
        );
        return sentMessage;
    } catch (error: any) {
        console.error('Error sending message:', error);
        // Eğer Markdown hatası varsa, tekrar Markdown olmadan dene
        if (error.description?.includes("can't parse entities")) {
            try {
                const sentMessage = await bot.telegram.sendMessage(chatId, text);
                return sentMessage;
            } catch (retryError) {
                throw retryError;
            }
        }
        throw error;
    }
}

export { sendMessage }
