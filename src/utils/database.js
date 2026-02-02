const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./logger');
const logger = createLogger('utils.database');

class Database {
    constructor(dbPath = null) {
        // Default path if not provided
        this.dbPath = dbPath || path.join(__dirname, '../../data/memory/user_memory.db');
        
        // Ensure directory exists
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        this.db = null;
        this.isInitialized = false;
    }

    /**
     * Initialize database connection and create tables
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    logger.error('Database connection error', err);
                    reject(err);
                    return;
                }
                
                logger.info('Database connected', { path: this.dbPath });
                
                // Create tables
                this.createTables()
                    .then(() => {
                        this.isInitialized = true;
                        resolve();
                    })
                    .catch(reject);
            });
        });
    }

    /**
     * Create database tables
     * @returns {Promise<void>}
     */
    async createTables() {
        const tables = [
            // User profile and preferences
            `CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT,
                category TEXT,
                confidence REAL DEFAULT 0.5,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Conversation history (last 10 prompts)
            `CREATE TABLE IF NOT EXISTS conversation_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_message TEXT NOT NULL,
                ai_response TEXT,
                intent_type TEXT,
                intent_category TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Learned facts about user
            `CREATE TABLE IF NOT EXISTS user_facts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fact_type TEXT NOT NULL,
                fact_value TEXT NOT NULL,
                source TEXT,
                confidence REAL DEFAULT 0.5,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // User preferences and settings
            `CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                preference_key TEXT UNIQUE NOT NULL,
                preference_value TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        // Create indexes
        const indexes = [
            `CREATE INDEX IF NOT EXISTS idx_profile_key ON user_profile(key)`,
            `CREATE INDEX IF NOT EXISTS idx_profile_category ON user_profile(category)`,
            `CREATE INDEX IF NOT EXISTS idx_history_created ON conversation_history(created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_facts_type ON user_facts(fact_type)`,
            `CREATE INDEX IF NOT EXISTS idx_preferences_key ON user_preferences(preference_key)`
        ];

        try {
            for (const sql of tables) {
                await this.run(sql);
            }
            
            for (const sql of indexes) {
                await this.run(sql);
            }
            
            logger.info('Database tables created successfully');
        } catch (error) {
            logger.error('Error creating tables', error);
            throw error;
        }
    }

    /**
     * Run a SQL query
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<any>}
     */
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    logger.error('Query error', { sql, error: err.message });
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * Get a single row
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Object|null>}
     */
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    logger.error('Query error', { sql, error: err.message });
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    }

    /**
     * Get all rows
     * @param {string} sql - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Array>}
     */
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    logger.error('Query error', { sql, error: err.message });
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Close database connection
     * @returns {Promise<void>}
     */
    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        logger.error('Error closing database', err);
                        reject(err);
                    } else {
                        logger.info('Database connection closed');
                        this.isInitialized = false;
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Clear old conversation history (keep only last N)
     * @param {number} keepLast - Number of recent conversations to keep
     * @returns {Promise<number>}
     */
    async cleanupHistory(keepLast = 10) {
        const sql = `
            DELETE FROM conversation_history 
            WHERE id NOT IN (
                SELECT id FROM conversation_history 
                ORDER BY created_at DESC 
                LIMIT ?
            )
        `;
        
        const result = await this.run(sql, [keepLast]);
        logger.info(`Cleaned up old history, kept last ${keepLast}`, { deleted: result.changes });
        return result.changes;
    }
}

// Singleton instance
let dbInstance = null;

/**
 * Get database instance (singleton)
 * @returns {Database}
 */
function getDatabase() {
    if (!dbInstance) {
        dbInstance = new Database();
    }
    return dbInstance;
}

module.exports = { Database, getDatabase };
