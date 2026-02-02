/**
 * Test user fact extraction from messages
 */

const { getMemoryManager } = require('../src/utils/memory_manager');

async function testExtraction() {
    const memory = getMemoryManager();
    
    const testMessages = [
        "Benim adım Eren ve 25 yaşındayım",
        "I am 30 years old and I live in Istanbul",
        "Yaşım 28 ve İstanbul'da yaşıyorum",
        "My name is John, I'm 35 years old and I work as a software developer",
        "22 yaşındayım ve yazılım geliştiriciyim, Python seviyorum",
        "I'm a 40 year old developer from New York, I love playing guitar",
        "Google'da çalışıyorum ve makine öğrenimi üzerine çalışıyorum",
        "I graduated from MIT and I speak Turkish, English and Spanish"
    ];
    
    console.log('🧠 Testing AI-powered fact extraction...\n');
    console.log('This may take a few moments as AI analyzes each message...\n');
    
    for (const message of testMessages) {
        console.log(`📝 Message: "${message}"`);
        const insights = await memory.extractInsights(message);
        console.log(`   ✅ Extracted ${insights.facts.length} facts:`, 
            insights.facts.map(f => `${f.type}=${f.value} (${(f.confidence*100).toFixed(0)}%)`).join(', ')
        );
        console.log();
    }
    
    console.log('\n=== All User Facts in Database ===\n');
    const allFacts = await memory.getUserFacts();
    allFacts.forEach(fact => {
        console.log(`${fact.fact_type}: ${fact.fact_value} (confidence: ${(fact.confidence * 100).toFixed(0)}%)`);
    });
    
    console.log('\n=== Memory Context ===\n');
    const context = await memory.generateMemoryContext();
    console.log(context);
    
    // Cleanup
    const { getDatabase } = require('../src/utils/database');
    await getDatabase().close();
}

if (require.main === module) {
    testExtraction().catch(console.error);
}

module.exports = { testExtraction };
