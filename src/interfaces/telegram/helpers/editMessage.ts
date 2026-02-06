/**
 * Edit Message Helper Function
 * @param {Object} bot - The Telegram bot instance.
 * @param {Number} chatId - The chat ID where the message is located.
 * @param {Number} messageId - The ID of the message to be edited.
 * @param {String} newText - The new text content for the message.
 * @returns {Promise<Object>} - The edited message object.
 */ 
async function editMessage(bot: any, chatId: number, messageId: number, newText: string, appendUp: string= ""): Promise<any> {    
    newText = appendUp + '\n\n'+ newText;
    
    
    try {
        await bot.telegram.sendChatAction(chatId,'typing')
        const editedMessage = await bot.telegram.editMessageText(
            chatId, 
            messageId, 
            undefined, 
            newText, 
            {
            parse_mode: 'Markdown',
        }
    );
        return editedMessage;
    } catch (error) {
        console.error('Error editing message:', error);
        throw error;
    }
}

export { editMessage }