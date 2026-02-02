/**
 * System Context Usage Examples
 * This file demonstrates how to use the system context utilities
 */

const { 
    generateSystemContext, 
    generateCompactSystemContext,
    getSystemContextObject,
    isToolAvailable,
    getCommandRecommendations,
    injectSystemContext
} = require('../src/utils/system_context');

// Example 1: Get full system context for AI prompts
async function example1_fullContext() {
    console.log('=== Example 1: Full System Context ===\n');
    const context = await generateSystemContext();
    console.log(context);
}

// Example 2: Get compact context for shorter prompts
async function example2_compactContext() {
    console.log('\n=== Example 2: Compact System Context ===\n');
    const context = await generateCompactSystemContext();
    console.log(context);
}

// Example 3: Get structured object for programmatic use
async function example3_structuredContext() {
    console.log('\n=== Example 3: Structured Context Object ===\n');
    const context = await getSystemContextObject();
    console.log(JSON.stringify(context, null, 2));
}

// Example 4: Check if tools are available
async function example4_checkTools() {
    console.log('\n=== Example 4: Check Tool Availability ===\n');
    const tools = ['python3', 'node', 'git', 'docker', 'kubectl'];
    
    for (const tool of tools) {
        const available = isToolAvailable(tool);
        console.log(`${tool}: ${available ? '✓ Available' : '✗ Not Available'}`);
    }
}

// Example 5: Get command recommendations
async function example5_recommendations() {
    console.log('\n=== Example 5: Command Recommendations ===\n');
    
    const tasks = ['install_package', 'run_python', 'text_editor', 'file_explorer'];
    
    for (const task of tasks) {
        const rec = await getCommandRecommendations(task);
        console.log(`${task}:`, rec);
    }
}

// Example 6: Inject context into a prompt
async function example6_injectContext() {
    console.log('\n=== Example 6: Inject Context into Prompt ===\n');
    
    const originalPrompt = `
You are a helpful AI assistant. Help the user with their request.
User: Install Python packages for data science
`;
    
    const enhancedPrompt = await injectSystemContext(originalPrompt, {
        compact: true,
        position: 'start'
    });
    
    console.log(enhancedPrompt);
}

// Run all examples
async function runAllExamples() {
    try {
        await example1_fullContext();
        await example2_compactContext();
        await example3_structuredContext();
        await example4_checkTools();
        await example5_recommendations();
        await example6_injectContext();
    } catch (error) {
        console.error('Error running examples:', error);
    }
}

// Run if called directly
if (require.main === module) {
    runAllExamples();
}

module.exports = {
    example1_fullContext,
    example2_compactContext,
    example3_structuredContext,
    example4_checkTools,
    example5_recommendations,
    example6_injectContext,
    runAllExamples
};
