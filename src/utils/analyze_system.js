const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { createLogger } = require('./logger');
const logger = createLogger('utils.analyze_system');

/**
 * Safely execute a shell command and return output
 * @param {string} cmd - Command to execute
 * @param {Object} options - Execution options
 * @returns {Promise<string|null>} Command output or null on error
 */
function execSafe(cmd, options = {}) {
    try {
        const result = execSync(cmd, { 
            stdio: 'pipe',
            encoding: 'utf-8',
            timeout: options.timeout || 5000,
            ...options
        });
        return result.toString().trim();
    } catch (error) {
        logger.debug(`Command failed: ${cmd}`, error.message);
        return null;
    }
}

/**
 * Check if a command exists in the system
 * @param {string} command - Command name to check
 * @returns {boolean} True if command exists
 */
function commandExists(command) {
    const checkCmd = os.platform() === 'win32' ? `where ${command}` : `which ${command}`;
    return execSafe(checkCmd) !== null;
}

/**
 * Get installed development tools and their versions
 * @returns {Promise<Object>} Installed tools information
 */
async function getInstalledTools() {
    const tools = {
        languages: {},
        packageManagers: {},
        versionControl: {},
        containerization: {},
        databases: {},
        browsers: {},
        editors: {}
    };

    // Programming Languages
    const languageChecks = [
        { name: 'node', cmd: 'node --version', category: 'languages' },
        { name: 'python', cmd: 'python --version', fallback: 'python3 --version', category: 'languages' },
        { name: 'java', cmd: 'java -version', category: 'languages' },
        { name: 'go', cmd: 'go version', category: 'languages' },
        { name: 'rust', cmd: 'rustc --version', category: 'languages' },
        { name: 'ruby', cmd: 'ruby --version', category: 'languages' },
        { name: 'php', cmd: 'php --version', category: 'languages' },
        { name: 'dotnet', cmd: 'dotnet --version', category: 'languages' }
    ];

    // Package Managers
    const packageManagerChecks = [
        { name: 'npm', cmd: 'npm --version', category: 'packageManagers' },
        { name: 'yarn', cmd: 'yarn --version', category: 'packageManagers' },
        { name: 'pnpm', cmd: 'pnpm --version', category: 'packageManagers' },
        { name: 'pip', cmd: 'pip --version', fallback: 'pip3 --version', category: 'packageManagers' },
        { name: 'conda', cmd: 'conda --version', category: 'packageManagers' },
        { name: 'brew', cmd: 'brew --version', category: 'packageManagers' }
    ];

    // Version Control & DevOps
    const devOpsChecks = [
        { name: 'git', cmd: 'git --version', category: 'versionControl' },
        { name: 'docker', cmd: 'docker --version', category: 'containerization' },
        { name: 'kubectl', cmd: 'kubectl version --client --short', category: 'containerization' },
        { name: 'helm', cmd: 'helm version --short', category: 'containerization' }
    ];

    // Databases
    const databaseChecks = [
        { name: 'mysql', cmd: 'mysql --version', category: 'databases' },
        { name: 'postgres', cmd: 'psql --version', category: 'databases' },
        { name: 'mongodb', cmd: 'mongod --version', category: 'databases' },
        { name: 'redis', cmd: 'redis-server --version', category: 'databases' }
    ];

    // Check all tools
    const allChecks = [...languageChecks, ...packageManagerChecks, ...devOpsChecks, ...databaseChecks];
    
    for (const check of allChecks) {
        let version = execSafe(check.cmd);
        if (!version && check.fallback) {
            version = execSafe(check.fallback);
        }
        
        if (version) {
            tools[check.category][check.name] = {
                installed: true,
                version: version,
                available: commandExists(check.name)
            };
        }
    }

    return tools;
}

/**
 * Get OS-specific information
 * @param {string} platform - Operating system platform
 * @returns {Promise<Object>} OS-specific details
 */
async function getOSSpecificInfo(platform) {
    const info = { name: '', version: '', kernel: '', details: null };

    switch (platform) {
        case 'win32':
            info.name = 'Windows';
            info.version = execSafe('ver') || os.release();
            info.details = {
                build: execSafe('wmic os get BuildNumber'),
                architecture: execSafe('wmic os get OSArchitecture')
            };
            break;

        case 'linux':
            info.name = 'Linux';
            info.kernel = execSafe('uname -r');
            const distro = execSafe('cat /etc/os-release');
            if (distro) {
                const lines = distro.split('\n');
                info.details = {};
                lines.forEach(line => {
                    const [key, value] = line.split('=');
                    if (key && value) {
                        info.details[key] = value.replace(/"/g, '');
                    }
                });
            }
            break;

        case 'darwin':
            info.name = 'macOS';
            const swVers = execSafe('sw_vers');
            if (swVers) {
                const lines = swVers.split('\n');
                info.details = {};
                lines.forEach(line => {
                    const [key, ...valueParts] = line.split(':');
                    if (key && valueParts.length > 0) {
                        info.details[key.trim()] = valueParts.join(':').trim();
                    }
                });
            }
            info.kernel = execSafe('uname -r');
            break;
    }

    return info;
}

/**
 * Get disk space information
 * @param {string} platform - Operating system platform
 * @returns {Promise<Object>} Disk space details
 */
async function getDiskInfo(platform) {
    let diskOutput = null;
    const diskInfo = { raw: null, parsed: [] };

    if (platform === 'win32') {
        diskOutput = execSafe('wmic logicaldisk get size,freespace,caption');
    } else {
        diskOutput = execSafe('df -h');
    }

    diskInfo.raw = diskOutput;

    // Parse disk info for easier AI consumption
    if (diskOutput && platform !== 'win32') {
        const lines = diskOutput.split('\n').slice(1);
        lines.forEach(line => {
            const parts = line.split(/\s+/);
            if (parts.length >= 6) {
                diskInfo.parsed.push({
                    filesystem: parts[0],
                    size: parts[1],
                    used: parts[2],
                    available: parts[3],
                    usePercent: parts[4],
                    mountPoint: parts[5]
                });
            }
        });
    }

    return diskInfo;
}

/**
 * Get system capabilities for AI decision making
 * @param {Object} sysInfo - System information object
 * @returns {Object} System capabilities
 */
function getSystemCapabilities(sysInfo) {
    const capabilities = {
        canExecuteShell: true,
        canRunScripts: true,
        hasInternet: true, // Could be enhanced with actual network check
        automation: {
            canRunPython: !!sysInfo.tools?.languages?.python,
            canRunNode: !!sysInfo.tools?.languages?.node,
            canUseDocker: !!sysInfo.tools?.containerization?.docker,
            canUseGit: !!sysInfo.tools?.versionControl?.git
        },
        development: {
            hasVersionControl: !!sysInfo.tools?.versionControl?.git,
            hasPackageManager: !!(sysInfo.tools?.packageManagers?.npm || 
                                 sysInfo.tools?.packageManagers?.yarn ||
                                 sysInfo.tools?.packageManagers?.pip),
            hasDatabase: Object.keys(sysInfo.tools?.databases || {}).length > 0
        },
        resources: {
            sufficient_memory: sysInfo.memory?.free_mb > 1024,
            sufficient_disk: true, // Could be enhanced with actual disk check
            multi_core: sysInfo.cpu?.cores > 2
        }
    };

    return capabilities;
}

/**
 * Get comprehensive system information for AI analysis
 * @returns {Promise<Object>} Complete system information
 */
async function getSystemInfo() {
    const platform = os.platform();
    logger.info('Gathering system information...', { platform });

    const startTime = Date.now();

    try {
        // Gather all information
        const [osInfo, diskInfo, installedTools] = await Promise.all([
            getOSSpecificInfo(platform),
            getDiskInfo(platform),
            getInstalledTools()
        ]);

        // Network interfaces with better formatting
        const networkInterfaces = os.networkInterfaces();
        const activeNetworks = {};
        Object.keys(networkInterfaces).forEach(iface => {
            const addresses = networkInterfaces[iface]
                .filter(addr => !addr.internal)
                .map(addr => ({
                    address: addr.address,
                    family: addr.family,
                    netmask: addr.netmask,
                    mac: addr.mac
                }));
            if (addresses.length > 0) {
                activeNetworks[iface] = addresses;
            }
        });

        const cpus = os.cpus();
        const systemInfo = {
            metadata: {
                timestamp: new Date().toISOString(),
                collectionDuration_ms: Date.now() - startTime,
                version: '2.0.0'
            },

            system: {
                platform,
                platformName: osInfo.name,
                arch: os.arch(),
                hostname: os.hostname(),
                uptime_seconds: os.uptime(),
                uptime_human: formatUptime(os.uptime()),
                os: osInfo
            },

            hardware: {
                cpu: {
                    model: cpus[0]?.model || 'Unknown',
                    cores: cpus.length,
                    physicalCores: cpus.length,
                    speed_mhz: cpus[0]?.speed || 0,
                    architecture: os.arch(),
                    details: execSafe(
                        platform === 'darwin' ? 'sysctl -n machdep.cpu.brand_string' :
                        platform === 'linux' ? 'lscpu' :
                        platform === 'win32' ? 'wmic cpu get name' : ''
                    )
                },

                memory: {
                    total_bytes: os.totalmem(),
                    free_bytes: os.freemem(),
                    used_bytes: os.totalmem() - os.freemem(),
                    total_mb: Math.round(os.totalmem() / 1024 / 1024),
                    free_mb: Math.round(os.freemem() / 1024 / 1024),
                    used_mb: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
                    total_gb: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
                    free_percent: ((os.freemem() / os.totalmem()) * 100).toFixed(2),
                    used_percent: (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2)
                },

                disk: diskInfo
            },

            network: {
                interfaces: activeNetworks,
                hostname: os.hostname()
            },

            tools: installedTools,

            runtime: {
                node: {
                    version: process.version,
                    versions: process.versions
                },
                process: {
                    pid: process.pid,
                    cwd: process.cwd(),
                    execPath: process.execPath,
                    memoryUsage: process.memoryUsage(),
                    uptime_seconds: process.uptime()
                }
            },

            user: {
                username: os.userInfo().username,
                homedir: os.homedir(),
                uid: os.userInfo().uid,
                gid: os.userInfo().gid
            },

            environment: {
                shell: process.env.SHELL || process.env.ComSpec,
                term: process.env.TERM,
                lang: process.env.LANG,
                editor: process.env.EDITOR || process.env.VISUAL,
                path: process.env.PATH?.split(path.delimiter).slice(0, 20) // Limit path entries
            }
        };

        // Add system capabilities
        systemInfo.capabilities = getSystemCapabilities(systemInfo);

        logger.info('System information collected successfully', { 
            duration_ms: Date.now() - startTime 
        });

        return systemInfo;

    } catch (error) {
        logger.error('Error gathering system information', error);
        throw error;
    }
}

/**
 * Format uptime in human-readable format
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.join(' ') || '0m';
}

/**
 * Generate and save system information document
 * @param {string} filepath - Path to save the document
 * @returns {Promise<Object>} Generated system information
 */
async function generateOSdocument(filepath) {
    logger.info('Generating OS document', { filepath });
    
    try {
        const sysInfo = await getSystemInfo();
        
        // Ensure directory exists
        const dir = path.dirname(filepath);
        if (!fsSync.existsSync(dir)) {
            await fs.mkdir(dir, { recursive: true });
        }
        
        // Write with better formatting
        await fs.writeFile(
            filepath, 
            JSON.stringify(sysInfo, null, 2), 
            'utf-8'
        );
        
        logger.info('OS document generated successfully', { 
            filepath,
            size_bytes: fsSync.statSync(filepath).size
        });
        
        return sysInfo;
    } catch (error) {
        logger.error('Error generating OS document', { filepath, error: error.message });
        throw error;
    }
}

/**
 * Get quick system summary for AI context
 * @returns {Promise<string>} Human-readable system summary
 */
async function getSystemSummary() {
    const info = await getSystemInfo();
    
    return `System: ${info.system.platformName} ${info.system.arch}
CPU: ${info.hardware.cpu.cores} cores, ${info.hardware.cpu.model}
Memory: ${info.hardware.memory.total_gb}GB (${info.hardware.memory.free_percent}% free)
Node: ${info.runtime.node.version}
Capabilities: ${Object.entries(info.capabilities.automation)
    .filter(([_, v]) => v)
    .map(([k, _]) => k.replace('canRun', '').replace('canUse', ''))
    .join(', ') || 'Basic shell'}`;
}

module.exports = { 
    getSystemInfo, 
    generateOSdocument,
    getSystemSummary,
    commandExists
};