import { config } from '../../../config.js'

const ADMIN_ID = config.telegram.adminId


/**
 * Helper function to check if a user is authorized based on ADMIN_ID environment variable.
 * @param {Number} userId - The Telegram user ID to check.
 * @returns {boolean} - True if authorized, false otherwise.
 */
async function isUserAuthorized(userId: number): Promise<boolean> {
    if (userId === ADMIN_ID) {
        return true
    }
    return false
}

export { isUserAuthorized }
