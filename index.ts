import { startTelegramBot } from './src/interfaces/telegram/bot.js';


// Main function to start the application
async function main() {
    console.log('Starting Telegram bot...');
    await startTelegramBot();
}

// Run the main function
main().catch((error) => {
    console.error('Error starting the application:', error);
    process.exit(1);
});