const { startTelegramBot } = require('./src/interfaces/telegram/bot');
const { generateOSdocument } = require('./src/utils/analyze_system');
const { createLogger } = require('./src/utils/logger');

const logger = createLogger('index');

process.on('uncaughtException', (err) => {
    logger.error('KRİTİK HATA:', err);
});


/* Main function to start the application */
async function main() {
    logger.info('Starting The Application...');
    
    await generateOSdocument('data/system_info.json');
    await startTelegramBot();
    logger.info('Application Started Successfully.');
};

main();