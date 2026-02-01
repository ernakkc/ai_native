const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function runCommand(command) {
    try {
        const { stdout, stderr } = await execAsync(command, {
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        return {
            success: true,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            command: command
        };
    } catch (error) {
        return {
            success: false,
            stdout: error.stdout ? error.stdout.trim() : '',
            stderr: error.stderr ? error.stderr.trim() : '',
            error: error.message,
            command: command,
            exitCode: error.code
        };
    }
}

module.exports = { runCommand };