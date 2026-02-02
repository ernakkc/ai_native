const { getSystemInfo, getSystemSummary, commandExists } = require('./analyze_system');
const { createLogger } = require('./logger');
const logger = createLogger('utils.system_context');

/**
 * Generate AI-friendly system context for prompts
 * @returns {Promise<string>} Formatted system context
 */
async function generateSystemContext() {
    try {
        const info = await getSystemInfo();
        
        // Build capabilities list
        const capabilities = [];
        
        // Programming languages
        if (info.tools?.languages?.python) {
            capabilities.push(`✓ Python ${info.tools.languages.python.version}`);
        }
        if (info.tools?.languages?.node) {
            capabilities.push(`✓ Node.js ${info.tools.languages.node.version}`);
        }
        if (info.tools?.languages?.java) {
            capabilities.push(`✓ Java ${info.tools.languages.java.version}`);
        }
        
        // Essential tools
        if (info.tools?.versionControl?.git) {
            capabilities.push(`✓ Git ${info.tools.versionControl.git.version}`);
        }
        if (info.tools?.containerization?.docker) {
            capabilities.push(`✓ Docker ${info.tools.containerization.docker.version}`);
        }
        
        // Package managers
        const packageManagers = Object.keys(info.tools?.packageManagers || {});
        if (packageManagers.length > 0) {
            capabilities.push(`✓ Package Managers: ${packageManagers.join(', ')}`);
        }
        
        // Databases
        const databases = Object.keys(info.tools?.databases || {});
        if (databases.length > 0) {
            capabilities.push(`✓ Databases: ${databases.join(', ')}`);
        }
        
        const context = `
## SYSTEM ENVIRONMENT

**Operating System:** ${info.system.platformName} ${info.system.arch}
**Hostname:** ${info.system.hostname}
**User:** ${info.user.username}
**Home Directory:** ${info.user.homedir}
**Current Working Directory:** ${info.runtime.process.cwd}
**Shell:** ${info.environment.shell || 'Unknown'}

**Hardware Resources:**
- CPU: ${info.hardware.cpu.cores} cores (${info.hardware.cpu.model})
- Memory: ${info.hardware.memory.total_gb}GB total, ${info.hardware.memory.free_mb}MB free (${info.hardware.memory.free_percent}% available)
- Disk Space: ${info.hardware.disk.parsed.length > 0 ? info.hardware.disk.parsed[0].available + ' available' : 'Available'}

**Available Tools & Capabilities:**
${capabilities.map(c => '- ' + c).join('\n')}

**System Capabilities:**
- Can Execute Shell Commands: ${info.capabilities.canExecuteShell ? 'YES' : 'NO'}
- Can Run Python Scripts: ${info.capabilities.automation.canRunPython ? 'YES' : 'NO'}
- Can Run Node.js Scripts: ${info.capabilities.automation.canRunNode ? 'YES' : 'NO'}
- Can Use Docker: ${info.capabilities.automation.canUseDocker ? 'YES' : 'NO'}
- Has Version Control: ${info.capabilities.development.hasVersionControl ? 'YES' : 'NO'}
- Has Package Manager: ${info.capabilities.development.hasPackageManager ? 'YES' : 'NO'}
- Has Database Access: ${info.capabilities.development.hasDatabase ? 'YES' : 'NO'}

**Resource Status:**
- Memory Status: ${info.capabilities.resources.sufficient_memory ? 'ADEQUATE' : 'LOW'}
- CPU Cores: ${info.capabilities.resources.multi_core ? 'MULTI-CORE' : 'SINGLE-CORE'}

**Important Notes:**
- All file paths should use absolute paths starting from ${info.user.homedir}
- Platform-specific path separator: ${info.system.platform === 'win32' ? '\\' : '/'}
- Shell commands should be optimized for: ${info.environment.shell}
- Available disk space: Check before creating large files
- Memory usage: Current free memory is ${info.hardware.memory.free_mb}MB

Use this information to:
1. Choose appropriate tools and commands for this platform
2. Verify capabilities before suggesting operations
3. Optimize resource usage based on available memory/CPU
4. Use correct path formats and separators
5. Suggest alternatives when tools are not available
`;
        
        return context.trim();
    } catch (error) {
        logger.error('Error generating system context', error);
        return `
## SYSTEM ENVIRONMENT
**Status:** Unable to detect system information
**Default Mode:** Basic shell commands available
`;
    }
}

/**
 * Generate a compact system context for short prompts
 * @returns {Promise<string>} Compact system summary
 */
async function generateCompactSystemContext() {
    try {
        const summary = await getSystemSummary();
        return `\n## SYSTEM: ${summary}\n`;
    } catch (error) {
        logger.error('Error generating compact system context', error);
        return '\n## SYSTEM: Unknown\n';
    }
}

/**
 * Get system context as structured object for API use
 * @returns {Promise<Object>} System context object
 */
async function getSystemContextObject() {
    try {
        const info = await getSystemInfo();
        
        return {
            os: {
                platform: info.system.platform,
                name: info.system.platformName,
                arch: info.system.arch
            },
            resources: {
                cpu_cores: info.hardware.cpu.cores,
                memory_gb: parseFloat(info.hardware.memory.total_gb),
                memory_free_mb: info.hardware.memory.free_mb
            },
            tools: {
                python: !!info.tools?.languages?.python,
                node: !!info.tools?.languages?.node,
                git: !!info.tools?.versionControl?.git,
                docker: !!info.tools?.containerization?.docker
            },
            capabilities: info.capabilities,
            paths: {
                home: info.user.homedir,
                cwd: info.runtime.process.cwd,
                shell: info.environment.shell
            }
        };
    } catch (error) {
        logger.error('Error getting system context object', error);
        return null;
    }
}

/**
 * Check if a specific command/tool is available
 * @param {string} command - Command to check
 * @returns {boolean} True if command exists
 */
function isToolAvailable(command) {
    return commandExists(command);
}

/**
 * Get environment-specific command recommendations
 * @param {string} task - Task type (e.g., 'install_package', 'run_python')
 * @returns {Promise<Object>} Recommended commands
 */
async function getCommandRecommendations(task) {
    const info = await getSystemInfo();
    const platform = info.system.platform;
    
    const recommendations = {
        install_package: {
            darwin: 'brew install',
            linux: 'sudo apt-get install',
            win32: 'choco install'
        },
        run_python: {
            darwin: info.tools?.languages?.python ? 'python3' : null,
            linux: info.tools?.languages?.python ? 'python3' : null,
            win32: info.tools?.languages?.python ? 'python' : null
        },
        text_editor: {
            darwin: 'nano',
            linux: 'nano',
            win32: 'notepad'
        },
        file_explorer: {
            darwin: 'open',
            linux: 'xdg-open',
            win32: 'explorer'
        }
    };
    
    return {
        command: recommendations[task]?.[platform],
        available: recommendations[task]?.[platform] ? commandExists(recommendations[task][platform]) : false,
        platform: platform
    };
}

/**
 * Inject system context into prompt
 * @param {string} prompt - Original prompt
 * @param {Object} options - Options (compact, position, includeMemory)
 * @returns {Promise<string>} Prompt with system context
 */
async function injectSystemContext(prompt, options = {}) {
    const { compact = false, position = 'end', includeMemory = false } = options;
    
    let context = compact 
        ? await generateCompactSystemContext()
        : await generateSystemContext();
    
    // Add memory context if requested
    if (includeMemory) {
        const { getMemoryManager } = require('./memory_manager');
        const memoryManager = getMemoryManager();
        
        const memoryContext = compact
            ? await memoryManager.generateCompactMemoryContext()
            : await memoryManager.generateMemoryContext();
        
        context += '\n' + memoryContext;
    }
    
    if (position === 'start') {
        return context + '\n\n' + prompt;
    } else {
        return prompt + '\n\n' + context;
    }
}

module.exports = {
    generateSystemContext,
    generateCompactSystemContext,
    getSystemContextObject,
    isToolAvailable,
    getCommandRecommendations,
    injectSystemContext
};
