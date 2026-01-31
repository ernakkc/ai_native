const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');
const { createLogger } = require('./logger');
const logger = createLogger('utils.analyze_system');


async function execSafe(cmd) {
    try {
        return await execSync(cmd, { stdio: 'pipe' }).toString().trim();
    } catch {
        return null;
    }
}

async function getSystemInfo() {
    const platform = os.platform(); // win32 | linux | darwin

    let osInfo = {};
    let diskInfo = null;
    let cpuExtra = null;

    // 🖥️ OS'e göre özel komutlar
    if (platform === 'win32') {
        osInfo = {
            name: 'Windows',
            version: await execSafe('ver'),
            release: os.release()
        };
        diskInfo = await execSafe('wmic logicaldisk get size,freespace,caption');
        cpuExtra = await execSafe('wmic cpu get name');
    }

    if (platform === 'linux') {
        osInfo = {
            name: 'Linux',
            distro: await execSafe('cat /etc/os-release'),
            kernel: await execSafe('uname -r')
        };
        diskInfo = await execSafe('df -h');
        cpuExtra = await execSafe('lscpu');
    }

    if (platform === 'darwin') {
        osInfo = {
            name: 'macOS',
            version: await execSafe('sw_vers'),
            kernel: await execSafe('uname -r')
        };
        diskInfo = await execSafe('df -h');
        cpuExtra = await execSafe('sysctl -n machdep.cpu.brand_string');
    }

    return {
        timestamp: new Date().toISOString(),

        system: {
            platform,
            arch: os.arch(),
            hostname: os.hostname(),
            uptime_seconds: os.uptime(),
            os: osInfo
        },

        cpu: {
            model: os.cpus()[0]?.model,
            cores: os.cpus().length,
            speed_mhz: os.cpus()[0]?.speed,
            extra: cpuExtra
        },

        memory: {
            total_mb: Math.round(os.totalmem() / 1024 / 1024),
            free_mb: Math.round(os.freemem() / 1024 / 1024),
            used_mb: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)
        },

        disk: diskInfo,

        network: os.networkInterfaces(),

        runtime: {
            node: process.version,
            npm: await execSafe('npm -v'),
            python: await execSafe('python --version') || await execSafe('python3 --version'),
            pip: await execSafe('pip --version') || await execSafe('pip3 --version')
        },

        user: {
            username: os.userInfo().username,
            homedir: os.homedir()
        },

        env: {
            shell: process.env.SHELL || process.env.ComSpec,
            path: process.env.PATH
        }
    };
}


async function generateOSdocument(filepath) {
    logger.info('generateOSdocument writing to', filepath);
    const sysInfo = await getSystemInfo();
    fs.writeFileSync(filepath, JSON.stringify(sysInfo, null, 2), 'utf-8');
    logger.info('generateOSdocument written');
}


module.exports = { getSystemInfo , generateOSdocument };