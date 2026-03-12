import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import { config } from '../config/index.js';
import { normalizeTagName, parseStoredTags } from '../utils/tags.js';
import {
  User,
  Category,
  Question,
  LearningProgress,
  AIConfig,
  UserPermissions,
  DatabaseConnectionConfig,
  DatabaseTableCountSummary,
} from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

type SQLiteDB = Database.Database;

type MySQLConnection = mysql.Pool;

const DEFAULT_USER_PERMISSIONS: UserPermissions = {
  question_view: true,
  question_create: true,
  question_edit_content: true,
  question_edit_meta: true,
  question_delete: true,
  question_batch_edit: true,
  category_view: true,
  category_manage: true,
  import_manage: true,
  question_export: true,
  ai_use: true,
  ai_generate: true,
  ai_config_manage: true,
  ai_chat: true,
  tag_manage: true,
  duplicate_manage: true,
  backup_export: false,
  backup_restore: false,
  ai_polish: true,
  system_manage: false,
  user_manage: false,
};

const ADMIN_PERMISSIONS: UserPermissions = {
  question_view: true,
  question_create: true,
  question_edit_content: true,
  question_edit_meta: true,
  question_delete: true,
  question_batch_edit: true,
  category_view: true,
  category_manage: true,
  import_manage: true,
  question_export: true,
  ai_use: true,
  ai_generate: true,
  ai_config_manage: true,
  ai_chat: true,
  tag_manage: true,
  duplicate_manage: true,
  backup_export: true,
  backup_restore: true,
  ai_polish: true,
  system_manage: true,
  user_manage: true,
};

export class DatabaseManager {
  private sqliteDb: SQLiteDB | null = null;
  private mysqlPool: MySQLConnection | null = null;
  private dbType: 'sqlite' | 'mysql';
  private databaseConfig: DatabaseConnectionConfig;
  private skipDefaultAdmin: boolean;

  constructor(databaseConfig: DatabaseConnectionConfig = config.database, options?: { skipDefaultAdmin?: boolean }) {
    this.databaseConfig = databaseConfig;
    this.dbType = databaseConfig.type;
    this.skipDefaultAdmin = Boolean(options?.skipDefaultAdmin);
  }

  async connect(): Promise<void> {
    if (this.dbType === 'sqlite') {
      await this.connectSQLite();
    } else {
      await this.connectMySQL();
    }
    await this.initializeTables();
    if (!this.skipDefaultAdmin) {
      await this.createDefaultAdmin();
    }
  }

  private async connectSQLite(): Promise<void> {
    const dbPath = this.databaseConfig.sqlite.path;
    const dbDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.sqliteDb = new Database(dbPath);
    this.sqliteDb.pragma('journal_mode = WAL');
    this.sqliteDb.pragma('foreign_keys = ON');
  }

  private async connectMySQL(): Promise<void> {
    const { host, port, user, password, database } = this.databaseConfig.mysql;
    
    this.mysqlPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    try {
      await this.mysqlPool.execute('SELECT 1');
    } catch (error) {
      console.error('MySQL connection failed:', error);
      throw error;
    }
  }

  private async initializeTables(): Promise<void> {
    if (this.dbType === 'sqlite') {
      this.initSQLiteTables();
    } else {
      await this.initMySQLTables();
    }
  }

  private initSQLiteTables(): void {
    if (!this.sqliteDb) return;

    this.sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        user_type TEXT DEFAULT 'independent',
        library_owner_id TEXT,
        category_scopes TEXT DEFAULT '[]',
        permissions TEXT DEFAULT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        parent_id TEXT,
        user_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        answer TEXT NOT NULL,
        explanation TEXT,
        difficulty TEXT DEFAULT 'medium',
        category_id TEXT,
        user_id TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS learning_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        mode TEXT DEFAULT 'study',
        last_viewed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        view_count INTEGER DEFAULT 0,
        is_bookmarked INTEGER DEFAULT 0,
        UNIQUE(user_id, question_id, mode),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_configs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        display_name TEXT,
        base_url TEXT,
        api_key TEXT NOT NULL,
        model TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        is_custom INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_questions_user_id ON questions(user_id);
      CREATE INDEX IF NOT EXISTS idx_questions_category_id ON questions(category_id);
      CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
      CREATE INDEX IF NOT EXISTS idx_learning_progress_user_id ON learning_progress(user_id);

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      INSERT OR IGNORE INTO system_settings (key, value) VALUES ('allow_register', 'true');
    `);

    try {
      this.sqliteDb.exec(`ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT NULL`);
    } catch (e) { /* Column already exists */ }
    try {
      this.sqliteDb.exec(`ALTER TABLE users ADD COLUMN user_type TEXT DEFAULT 'independent'`);
    } catch (e) { /* Column already exists */ }
    try {
      this.sqliteDb.exec(`ALTER TABLE users ADD COLUMN library_owner_id TEXT`);
    } catch (e) { /* Column already exists */ }
    try {
      this.sqliteDb.exec(`ALTER TABLE users ADD COLUMN category_scopes TEXT DEFAULT '[]'`);
    } catch (e) { /* Column already exists */ }

    try {
      this.sqliteDb.exec(`ALTER TABLE ai_configs ADD COLUMN display_name TEXT`);
    } catch (e) { /* Column already exists */ }

    try {
      this.sqliteDb.exec(`ALTER TABLE ai_configs ADD COLUMN base_url TEXT`);
    } catch (e) { /* Column already exists */ }

    try {
      this.sqliteDb.exec(`ALTER TABLE ai_configs ADD COLUMN is_custom INTEGER DEFAULT 0`);
    } catch (e) { /* Column already exists */ }
  }

  private async initMySQLTables(): Promise<void> {
    if (!this.mysqlPool) return;

    await this.mysqlPool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user') DEFAULT 'user',
        user_type VARCHAR(20) DEFAULT 'independent',
        library_owner_id VARCHAR(36) NULL,
        category_scopes TEXT NULL,
        permissions TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    try {
      await this.mysqlPool.execute(`
        ALTER TABLE users ADD COLUMN permissions TEXT NULL
      `);
    } catch (error) { /* Column already exists */ }
    try {
      await this.mysqlPool.execute(`
        ALTER TABLE users ADD COLUMN user_type VARCHAR(20) DEFAULT 'independent'
      `);
    } catch (error) { /* Column already exists */ }
    try {
      await this.mysqlPool.execute(`
        ALTER TABLE users ADD COLUMN library_owner_id VARCHAR(36) NULL
      `);
    } catch (error) { /* Column already exists */ }
    try {
      await this.mysqlPool.execute(`
        ALTER TABLE users ADD COLUMN category_scopes TEXT NULL
      `);
    } catch (error) { /* Column already exists */ }

    await this.mysqlPool.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parent_id VARCHAR(36),
        user_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `);

    await this.mysqlPool.execute(`
      CREATE TABLE IF NOT EXISTS questions (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        answer TEXT NOT NULL,
        explanation TEXT,
        difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
        category_id VARCHAR(36),
        user_id VARCHAR(36) NOT NULL,
        tags JSON DEFAULT ('[]'),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      )
    `);

    await this.mysqlPool.execute(`
      CREATE TABLE IF NOT EXISTS learning_progress (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        question_id VARCHAR(36) NOT NULL,
        mode ENUM('study', 'quiz') DEFAULT 'study',
        last_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        view_count INT DEFAULT 0,
        is_bookmarked BOOLEAN DEFAULT FALSE,
        UNIQUE KEY unique_user_question_mode (user_id, question_id, mode),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
      )
    `);

    await this.mysqlPool.execute(`
      CREATE TABLE IF NOT EXISTS ai_configs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        display_name VARCHAR(100),
        base_url VARCHAR(500),
        api_key VARCHAR(500) NOT NULL,
        model VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        is_custom BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await this.mysqlPool.execute(`
      CREATE INDEX IF NOT EXISTS idx_questions_user_id ON questions(user_id)
    `);
    await this.mysqlPool.execute(`
      CREATE INDEX IF NOT EXISTS idx_questions_category_id ON questions(category_id)
    `);
    await this.mysqlPool.execute(`
      CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)
    `);
    await this.mysqlPool.execute(`
      CREATE INDEX IF NOT EXISTS idx_learning_progress_user_id ON learning_progress(user_id)
    `);

    await this.mysqlPool.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        \`key\` VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await this.mysqlPool.execute(`
      INSERT IGNORE INTO system_settings (\`key\`, value) VALUES ('allow_register', 'true')
    `);
  }

  private async createDefaultAdmin(): Promise<void> {
    const { username, email, password } = config.initAdmin;
    if (!username || !email || !password) {
      return;
    }

    const adminExists = await this.getUserByUsername(username);
    const emailExists = await this.getUserByEmail(email);
    if (!adminExists && !emailExists) {
      const hashedPassword = await bcrypt.hash(password, 12);
      const admin: User = {
        id: uuidv4(),
        username,
        email,
        password_hash: hashedPassword,
        role: 'admin',
        user_type: 'independent',
        library_owner_id: null,
        category_scopes: [],
        permissions: ADMIN_PERMISSIONS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await this.createUser(admin);
      console.log(`Initial admin user created: ${username}`);
    }
  }

  async close(): Promise<void> {
    if (this.sqliteDb) {
      this.sqliteDb.close();
    }
    if (this.mysqlPool) {
      await this.mysqlPool.end();
    }
  }

  getDbType(): 'sqlite' | 'mysql' {
    return this.dbType;
  }

  async run(sql: string, params: unknown[] = []): Promise<unknown> {
    if (this.dbType === 'sqlite' && this.sqliteDb) {
      const stmt = this.sqliteDb.prepare(sql);
      return stmt.run(...params);
    } else if (this.mysqlPool) {
      const [result] = await this.mysqlPool.execute(sql, params);
      return result;
    }
    throw new Error('Database not connected');
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    if (this.dbType === 'sqlite' && this.sqliteDb) {
      const stmt = this.sqliteDb.prepare(sql);
      return stmt.get(...params) as T | undefined;
    } else if (this.mysqlPool) {
      const [rows] = await this.mysqlPool.execute(sql, params);
      const results = rows as T[];
      return results[0];
    }
    throw new Error('Database not connected');
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (this.dbType === 'sqlite' && this.sqliteDb) {
      const stmt = this.sqliteDb.prepare(sql);
      return stmt.all(...params) as T[];
    } else if (this.mysqlPool) {
      const [rows] = await this.mysqlPool.execute(sql, params);
      return rows as T[];
    }
    throw new Error('Database not connected');
  }

  private normalizePermissions(role: User['role'], permissions?: string | Partial<UserPermissions> | null): UserPermissions {
    const basePermissions = role === 'admin' ? ADMIN_PERMISSIONS : DEFAULT_USER_PERMISSIONS;
    let parsedPermissions: Partial<UserPermissions> = {};

    if (typeof permissions === 'string' && permissions.trim()) {
      try {
        parsedPermissions = JSON.parse(permissions) as Partial<UserPermissions>;
      } catch (error) {
        parsedPermissions = {};
      }
    } else if (permissions && typeof permissions === 'object') {
      parsedPermissions = permissions;
    }

    return {
      ...basePermissions,
      ...parsedPermissions,
      ...(role === 'admin' ? ADMIN_PERMISSIONS : {}),
    };
  }

  private normalizeCategoryScopes(scopes?: string | string[] | null): string[] {
    if (Array.isArray(scopes)) {
      return scopes.filter(Boolean);
    }

    if (typeof scopes === 'string' && scopes.trim()) {
      try {
        const parsed = JSON.parse(scopes);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch (error) {
        return [];
      }
    }

    return [];
  }

  private normalizeUserRecord(record?: Record<string, unknown> | null): User | undefined {
    if (!record) {
      return undefined;
    }

    const role = (record.role as User['role']) || 'user';
    return {
      ...(record as unknown as User),
      role,
      user_type: (record.user_type as User['user_type']) || 'independent',
      library_owner_id: (record.library_owner_id as string | null) || null,
      category_scopes: this.normalizeCategoryScopes(record.category_scopes as string | string[] | null | undefined),
      permissions: this.normalizePermissions(role, record.permissions as string | Partial<UserPermissions> | null | undefined),
    };
  }

  async createUser(user: User): Promise<User> {
    const sql = `
      INSERT INTO users (id, username, email, password_hash, role, user_type, library_owner_id, category_scopes, permissions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.run(sql, [
      user.id,
      user.username,
      user.email,
      user.password_hash,
      user.role,
      user.user_type,
      user.library_owner_id,
      JSON.stringify(user.category_scopes || []),
      JSON.stringify(this.normalizePermissions(user.role, user.permissions)),
      user.created_at,
      user.updated_at,
    ]);
    return this.normalizeUserRecord(user as unknown as Record<string, unknown>)!;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const user = await this.get<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [id]);
    return this.normalizeUserRecord(user);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = await this.get<Record<string, unknown>>('SELECT * FROM users WHERE username = ?', [username]);
    return this.normalizeUserRecord(user);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await this.get<Record<string, unknown>>('SELECT * FROM users WHERE email = ?', [email]);
    return this.normalizeUserRecord(user);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.username !== undefined) {
      fields.push('username = ?');
      values.push(data.username);
    }
    if (data.email !== undefined) {
      fields.push('email = ?');
      values.push(data.email);
    }
    if (data.password_hash !== undefined) {
      fields.push('password_hash = ?');
      values.push(data.password_hash);
    }
    if (data.role !== undefined) {
      fields.push('role = ?');
      values.push(data.role);
    }
    if (data.user_type !== undefined) {
      fields.push('user_type = ?');
      values.push(data.user_type);
    }
    if (data.library_owner_id !== undefined) {
      fields.push('library_owner_id = ?');
      values.push(data.library_owner_id);
    }
    if (data.category_scopes !== undefined) {
      fields.push('category_scopes = ?');
      values.push(JSON.stringify(data.category_scopes || []));
    }
    if (data.permissions !== undefined) {
      fields.push('permissions = ?');
      values.push(JSON.stringify(this.normalizePermissions(data.role || (await this.getUserById(id))?.role || 'user', data.permissions)));
    }

    if (fields.length === 0) return this.getUserById(id);

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getUserById(id);
  }

  async createCategory(category: Category): Promise<Category> {
    const sql = `
      INSERT INTO categories (id, name, description, parent_id, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.run(sql, [
      category.id,
      category.name,
      category.description,
      category.parent_id,
      category.user_id,
      category.created_at,
      category.updated_at,
    ]);
    return category;
  }

  async getCategoryById(id: string): Promise<Category | undefined> {
    return this.get<Category>('SELECT * FROM categories WHERE id = ?', [id]);
  }

  async getCategoriesByUserId(userId: string, allowedCategoryIds?: string[]): Promise<Category[]> {
    const params: unknown[] = [userId];
    let sql = 'SELECT * FROM categories WHERE user_id = ?';
    if (allowedCategoryIds && allowedCategoryIds.length > 0) {
      sql += ` AND id IN (${allowedCategoryIds.map(() => '?').join(',')})`;
      params.push(...allowedCategoryIds);
    }
    sql += ' ORDER BY name';
    return this.all<Category>(sql, params);
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.parent_id !== undefined) {
      fields.push('parent_id = ?');
      values.push(data.parent_id);
    }

    if (fields.length === 0) return this.getCategoryById(id);

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.run(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getCategoryById(id);
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await this.run('DELETE FROM categories WHERE id = ?', [id]);
    return (result as { changes: number }).changes > 0;
  }

  async createQuestion(question: Question): Promise<Question> {
    const sql = `
      INSERT INTO questions (id, title, content, answer, explanation, difficulty, category_id, user_id, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.run(sql, [
      question.id,
      question.title,
      question.content,
      question.answer,
      question.explanation,
      question.difficulty,
      question.category_id,
      question.user_id,
      question.tags,
      question.created_at,
      question.updated_at,
    ]);
    return question;
  }

  async getQuestionById(id: string): Promise<Question | undefined> {
    return this.get<Question>('SELECT * FROM questions WHERE id = ?', [id]);
  }

  async getQuestionByIdForUser(id: string, userId: string, isAdmin: boolean = false): Promise<Question | undefined> {
    if (isAdmin) {
      return this.getQuestionById(id);
    }
    return this.get<Question>('SELECT * FROM questions WHERE id = ? AND user_id = ?', [id, userId]);
  }

  async getQuestions(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
    filter?: { categoryId?: string; difficulty?: string; keyword?: string; tags?: string[] },
    allowedCategoryIds?: string[]
  ): Promise<{ questions: Question[]; total: number }> {
    const conditions: string[] = ['user_id = ?'];
    const params: unknown[] = [userId];

    if (filter?.categoryId) {
      conditions.push('category_id = ?');
      params.push(filter.categoryId);
    }
    if (allowedCategoryIds && allowedCategoryIds.length > 0) {
      conditions.push(`category_id IN (${allowedCategoryIds.map(() => '?').join(',')})`);
      params.push(...allowedCategoryIds);
    }
    if (filter?.difficulty) {
      conditions.push('difficulty = ?');
      params.push(filter.difficulty);
    }
    if (filter?.keyword) {
      conditions.push('(title LIKE ? OR content LIKE ? OR answer LIKE ? OR explanation LIKE ?)');
      params.push(`%${filter.keyword}%`, `%${filter.keyword}%`, `%${filter.keyword}%`, `%${filter.keyword}%`);
    }
    if (filter?.tags && filter.tags.length > 0) {
      const tagConditions = filter.tags.map(() => 'tags LIKE ?').join(' OR ');
      conditions.push(`(${tagConditions})`);
      params.push(...filter.tags.map((tag) => `%"${tag}"%`));
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * pageSize;

    const questions = await this.all<Question>(
      `SELECT * FROM questions WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const countResult = await this.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM questions WHERE ${whereClause}`,
      params
    );

    return { questions, total: countResult?.count || 0 };
  }

  async getQuestionTags(
    userId: string,
    filter?: { categoryId?: string; difficulty?: string; keyword?: string },
    allowedCategoryIds?: string[]
  ): Promise<{ name: string; count: number }[]> {
    const conditions: string[] = ['user_id = ?'];
    const params: unknown[] = [userId];

    if (filter?.categoryId) {
      conditions.push('category_id = ?');
      params.push(filter.categoryId);
    }
    if (allowedCategoryIds && allowedCategoryIds.length > 0) {
      conditions.push(`category_id IN (${allowedCategoryIds.map(() => '?').join(',')})`);
      params.push(...allowedCategoryIds);
    }
    if (filter?.difficulty) {
      conditions.push('difficulty = ?');
      params.push(filter.difficulty);
    }
    if (filter?.keyword) {
      conditions.push('(title LIKE ? OR content LIKE ? OR answer LIKE ? OR explanation LIKE ?)');
      params.push(`%${filter.keyword}%`, `%${filter.keyword}%`, `%${filter.keyword}%`, `%${filter.keyword}%`);
    }

    const whereClause = conditions.join(' AND ');
    const questions = await this.all<Question>(
      `SELECT tags FROM questions WHERE ${whereClause}`,
      params
    );

    const tagMap = new Map<string, number>();
    for (const question of questions) {
      for (const rawTag of parseStoredTags(question.tags)) {
        const tag = normalizeTagName(rawTag);
        if (!tag) continue;
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      }
    }

    return Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
  }

  async renameQuestionTag(userId: string, fromTag: string, toTag: string): Promise<number> {
    const questions = await this.all<Question>(
      'SELECT id, tags FROM questions WHERE user_id = ?',
      [userId]
    );

    let updatedCount = 0;
    const normalizedFromTag = normalizeTagName(fromTag);
    const normalizedToTag = normalizeTagName(toTag);
    for (const question of questions) {
      const parsedTags = parseStoredTags(question.tags);

      if (!parsedTags.includes(normalizedFromTag)) {
        continue;
      }

      const nextTags = Array.from(new Set(parsedTags.map((tag) => (tag === normalizedFromTag ? normalizedToTag : normalizeTagName(tag))).filter(Boolean)));
      await this.updateQuestion(question.id, { tags: JSON.stringify(nextTags) });
      updatedCount += 1;
    }

    return updatedCount;
  }

  async deleteQuestionTag(userId: string, tagName: string): Promise<number> {
    const questions = await this.all<Question>(
      'SELECT id, tags FROM questions WHERE user_id = ?',
      [userId]
    );

    let updatedCount = 0;
    const normalizedTagName = normalizeTagName(tagName);
    for (const question of questions) {
      const parsedTags = parseStoredTags(question.tags);

      if (!parsedTags.includes(normalizedTagName)) {
        continue;
      }

      const nextTags = parsedTags.filter((tag) => tag !== normalizedTagName);
      await this.updateQuestion(question.id, { tags: JSON.stringify(nextTags) });
      updatedCount += 1;
    }

    return updatedCount;
  }

  async updateQuestion(id: string, data: Partial<Question>): Promise<Question | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
    }
    if (data.content !== undefined) {
      fields.push('content = ?');
      values.push(data.content);
    }
    if (data.answer !== undefined) {
      fields.push('answer = ?');
      values.push(data.answer);
    }
    if (data.explanation !== undefined) {
      fields.push('explanation = ?');
      values.push(data.explanation);
    }
    if (data.difficulty !== undefined) {
      fields.push('difficulty = ?');
      values.push(data.difficulty);
    }
    if (data.category_id !== undefined) {
      fields.push('category_id = ?');
      values.push(data.category_id);
    }
    if (data.tags !== undefined) {
      fields.push('tags = ?');
      values.push(data.tags);
    }

    if (fields.length === 0) return this.getQuestionById(id);

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.run(`UPDATE questions SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.getQuestionById(id);
  }

  async deleteQuestion(id: string): Promise<boolean> {
    const result = await this.run('DELETE FROM questions WHERE id = ?', [id]);
    return (result as { changes: number }).changes > 0;
  }

  async deleteQuestions(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    const result = await this.run(`DELETE FROM questions WHERE id IN (${placeholders})`, ids);
    return (result as { changes: number }).changes;
  }

  async deleteQuestionsForUser(ids: string[], userId: string, isAdmin: boolean = false): Promise<number> {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    if (isAdmin) {
      return this.deleteQuestions(ids);
    }
    const result = await this.run(
      `DELETE FROM questions WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...ids]
    );
    return (result as { changes: number }).changes;
  }

  async clearAllQuestions(userId: string): Promise<number> {
    const result = await this.run('DELETE FROM questions WHERE user_id = ?', [userId]);
    return (result as { changes: number }).changes;
  }

  async upsertLearningProgress(progress: LearningProgress): Promise<LearningProgress> {
    const existing = await this.get<LearningProgress>(
      'SELECT * FROM learning_progress WHERE user_id = ? AND question_id = ? AND mode = ?',
      [progress.user_id, progress.question_id, progress.mode]
    );

    if (existing) {
      await this.run(
        `UPDATE learning_progress 
         SET last_viewed_at = ?, view_count = view_count + 1, is_bookmarked = ?
         WHERE id = ?`,
        [progress.last_viewed_at, progress.is_bookmarked ? 1 : 0, existing.id]
      );
      return { ...existing, ...progress, view_count: existing.view_count + 1 };
    } else {
      await this.run(
        `INSERT INTO learning_progress (id, user_id, question_id, mode, last_viewed_at, view_count, is_bookmarked)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [progress.id, progress.user_id, progress.question_id, progress.mode, progress.last_viewed_at, 1, progress.is_bookmarked ? 1 : 0]
      );
      return progress;
    }
  }

  async getLearningProgress(userId: string, questionId: string, mode: string): Promise<LearningProgress | undefined> {
    return this.get<LearningProgress>(
      'SELECT * FROM learning_progress WHERE user_id = ? AND question_id = ? AND mode = ?',
      [userId, questionId, mode]
    );
  }

  async getBookmarkedQuestions(userId: string, mode: string): Promise<Question[]> {
    return this.all<Question>(
      `SELECT q.* FROM questions q
       JOIN learning_progress lp ON q.id = lp.question_id
       WHERE lp.user_id = ? AND lp.mode = ? AND lp.is_bookmarked = 1
       ORDER BY lp.last_viewed_at DESC`,
      [userId, mode]
    );
  }

  async getLastViewedQuestion(userId: string, mode: string, categoryId?: string): Promise<LearningProgress | undefined> {
    if (categoryId) {
      return this.get<LearningProgress>(
        `SELECT lp.* FROM learning_progress lp
         JOIN questions q ON lp.question_id = q.id
         WHERE lp.user_id = ? AND lp.mode = ? AND q.category_id = ?
         ORDER BY lp.last_viewed_at DESC
         LIMIT 1`,
        [userId, mode, categoryId]
      );
    }
    return this.get<LearningProgress>(
      `SELECT * FROM learning_progress 
       WHERE user_id = ? AND mode = ?
       ORDER BY last_viewed_at DESC
       LIMIT 1`,
      [userId, mode]
    );
  }

  async getLearningStats(userId: string): Promise<{
    totalViewed: number;
    todayViewed: number;
    studyViewed: number;
    quizViewed: number;
    bookmarked: number;
    studyTime: number;
  }> {
    const totalResult = await this.get<{ count: number }>(
      `SELECT COUNT(DISTINCT question_id) as count FROM learning_progress WHERE user_id = ?`,
      [userId]
    );

    const todayResult = await this.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM learning_progress 
       WHERE user_id = ? AND date(last_viewed_at) = date('now')`,
      [userId]
    );

    const studyResult = await this.get<{ count: number }>(
      `SELECT COUNT(DISTINCT question_id) as count FROM learning_progress WHERE user_id = ? AND mode = 'study'`,
      [userId]
    );

    const quizResult = await this.get<{ count: number }>(
      `SELECT COUNT(DISTINCT question_id) as count FROM learning_progress WHERE user_id = ? AND mode = 'quiz'`,
      [userId]
    );

    const bookmarkResult = await this.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM learning_progress WHERE user_id = ? AND is_bookmarked = 1`,
      [userId]
    );

    const timeResult = await this.get<{ total: number }>(
      `SELECT COALESCE(SUM(view_count), 0) as total FROM learning_progress WHERE user_id = ?`,
      [userId]
    );

    return {
      totalViewed: totalResult?.count || 0,
      todayViewed: todayResult?.count || 0,
      studyViewed: studyResult?.count || 0,
      quizViewed: quizResult?.count || 0,
      bookmarked: bookmarkResult?.count || 0,
      studyTime: timeResult?.total || 0,
    };
  }

  async clearLearningProgress(userId: string): Promise<number> {
    const result = await this.run('DELETE FROM learning_progress WHERE user_id = ?', [userId]);
    return (result as { changes: number }).changes;
  }

  async createAIConfig(aiConfig: AIConfig): Promise<AIConfig> {
    await this.run(
      'UPDATE ai_configs SET is_active = 0 WHERE user_id = ?',
      [aiConfig.user_id]
    );
    await this.run(
      `INSERT INTO ai_configs (id, user_id, provider, display_name, base_url, api_key, model, is_active, is_custom, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [aiConfig.id, aiConfig.user_id, aiConfig.provider, aiConfig.display_name || null, aiConfig.base_url || null, aiConfig.api_key, aiConfig.model, aiConfig.is_active ? 1 : 0, aiConfig.is_custom ? 1 : 0, aiConfig.created_at, aiConfig.updated_at]
    );
    return aiConfig;
  }

  async getActiveAIConfig(userId: string): Promise<AIConfig | undefined> {
    return this.get<AIConfig>(
      'SELECT * FROM ai_configs WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
  }

  async getAIConfigsByUserId(userId: string): Promise<AIConfig[]> {
    return this.all<AIConfig>('SELECT * FROM ai_configs WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  }

  async getAIConfigById(id: string): Promise<AIConfig | undefined> {
    return this.get<AIConfig>('SELECT * FROM ai_configs WHERE id = ?', [id]);
  }

  async getAIConfigByIdForUser(id: string, userId: string): Promise<AIConfig | undefined> {
    return this.get<AIConfig>('SELECT * FROM ai_configs WHERE id = ? AND user_id = ?', [id, userId]);
  }

  async updateAIConfig(id: string, data: Partial<AIConfig>): Promise<AIConfig | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.provider !== undefined) {
      fields.push('provider = ?');
      values.push(data.provider);
    }
    if (data.display_name !== undefined) {
      fields.push('display_name = ?');
      values.push(data.display_name);
    }
    if (data.base_url !== undefined) {
      fields.push('base_url = ?');
      values.push(data.base_url);
    }
    if (data.api_key !== undefined) {
      fields.push('api_key = ?');
      values.push(data.api_key);
    }
    if (data.model !== undefined) {
      fields.push('model = ?');
      values.push(data.model);
    }
    if (data.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }

    if (fields.length === 0) {
      return this.get<AIConfig>('SELECT * FROM ai_configs WHERE id = ?', [id]);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.run(`UPDATE ai_configs SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.get<AIConfig>('SELECT * FROM ai_configs WHERE id = ?', [id]);
  }

  async deleteAIConfig(id: string): Promise<boolean> {
    const result = await this.run('DELETE FROM ai_configs WHERE id = ?', [id]);
    return (result as { changes: number }).changes > 0;
  }

  async deleteAIConfigForUser(id: string, userId: string): Promise<boolean> {
    const result = await this.run('DELETE FROM ai_configs WHERE id = ? AND user_id = ?', [id, userId]);
    return (result as { changes: number }).changes > 0;
  }

  async getSetting(key: string): Promise<string | undefined> {
    const result = await this.get<{ value: string }>('SELECT value FROM system_settings WHERE key = ?', [key]);
    return result?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    if (this.dbType === 'sqlite') {
      await this.run(
        'INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)',
        [key, value, new Date().toISOString()]
      );
    } else {
      await this.run(
        'INSERT INTO system_settings (`key`, value, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = ?',
        [key, value, new Date().toISOString(), value, new Date().toISOString()]
      );
    }
  }

  async getAllUsers(): Promise<User[]> {
    const users = await this.all<Record<string, unknown>>(
      'SELECT id, username, email, role, user_type, library_owner_id, category_scopes, permissions, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    return users
      .map((user) => this.normalizeUserRecord(user))
      .filter((user): user is User => Boolean(user));
  }

  async getUserCount(): Promise<number> {
    const result = await this.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
    return result?.count || 0;
  }

  async getQuestionCountByUser(userId: string): Promise<number> {
    const result = await this.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM questions WHERE user_id = ?',
      [userId]
    );
    return result?.count || 0;
  }

  async getCategoryCountByUser(userId: string): Promise<number> {
    const result = await this.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM categories WHERE user_id = ?',
      [userId]
    );
    return result?.count || 0;
  }

  async deleteUser(id: string): Promise<boolean> {
    const user = await this.getUserById(id);
    if (user?.role === 'admin') {
      const adminCount = await this.get<{ count: number }>("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
      if (adminCount && adminCount.count <= 1) {
        return false;
      }
    }
    const result = await this.run('DELETE FROM users WHERE id = ?', [id]);
    return (result as { changes: number }).changes > 0;
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      return undefined;
    }

    const permissions = role === 'admin'
      ? ADMIN_PERMISSIONS
      : this.normalizePermissions('user', existingUser.role === 'user' ? existingUser.permissions : DEFAULT_USER_PERMISSIONS);
    await this.run('UPDATE users SET role = ?, user_type = ?, library_owner_id = ?, category_scopes = ?, permissions = ?, updated_at = ? WHERE id = ?', [
      role,
      role === 'admin' ? 'independent' : existingUser.user_type,
      role === 'admin' ? null : existingUser.library_owner_id,
      role === 'admin' ? JSON.stringify([]) : JSON.stringify(existingUser.category_scopes || []),
      JSON.stringify(permissions),
      new Date().toISOString(),
      id,
    ]);
    return this.getUserById(id);
  }

  async getTableCounts(): Promise<DatabaseTableCountSummary> {
    const tables = [
      'users',
      'categories',
      'questions',
      'learning_progress',
      'ai_configs',
      'system_settings',
    ] as const;

    const entries = await Promise.all(
      tables.map(async (table) => {
        const result = await this.get<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
        return [table, result?.count || 0] as const;
      })
    );

    const counts = Object.fromEntries(entries) as Record<string, number>;
    return {
      users: counts.users || 0,
      categories: counts.categories || 0,
      questions: counts.questions || 0,
      learning_progress: counts.learning_progress || 0,
      ai_configs: counts.ai_configs || 0,
      system_settings: counts.system_settings || 0,
    };
  }

  async exportAllData(): Promise<Record<string, Record<string, unknown>[]>> {
    return {
      users: await this.all<Record<string, unknown>>('SELECT * FROM users ORDER BY created_at ASC'),
      categories: await this.all<Record<string, unknown>>('SELECT * FROM categories ORDER BY created_at ASC'),
      questions: await this.all<Record<string, unknown>>('SELECT * FROM questions ORDER BY created_at ASC'),
      learning_progress: await this.all<Record<string, unknown>>('SELECT * FROM learning_progress ORDER BY last_viewed_at ASC'),
      ai_configs: await this.all<Record<string, unknown>>('SELECT * FROM ai_configs ORDER BY created_at ASC'),
      system_settings: await this.all<Record<string, unknown>>('SELECT * FROM system_settings ORDER BY `key` ASC'),
    };
  }

  async replaceAllData(dataset: Record<string, Record<string, unknown>[]>): Promise<void> {
    await this.run('DELETE FROM learning_progress');
    await this.run('DELETE FROM questions');
    await this.run('DELETE FROM categories');
    await this.run('DELETE FROM ai_configs');
    await this.run('DELETE FROM users');
    await this.run('DELETE FROM system_settings');

    await this.bulkInsert('users', ['id', 'username', 'email', 'password_hash', 'role', 'permissions', 'created_at', 'updated_at'], dataset.users || []);
    await this.bulkInsert('categories', ['id', 'name', 'description', 'parent_id', 'user_id', 'created_at', 'updated_at'], dataset.categories || []);
    await this.bulkInsert('questions', ['id', 'title', 'content', 'answer', 'explanation', 'difficulty', 'category_id', 'user_id', 'tags', 'created_at', 'updated_at'], dataset.questions || []);
    await this.bulkInsert('learning_progress', ['id', 'user_id', 'question_id', 'mode', 'last_viewed_at', 'view_count', 'is_bookmarked'], dataset.learning_progress || []);
    await this.bulkInsert('ai_configs', ['id', 'user_id', 'provider', 'display_name', 'base_url', 'api_key', 'model', 'is_active', 'is_custom', 'created_at', 'updated_at'], dataset.ai_configs || []);
    await this.bulkInsert('system_settings', ['key', 'value', 'updated_at'], dataset.system_settings || []);
  }

  private async bulkInsert(table: string, columns: string[], rows: Record<string, unknown>[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.map((column) => (column === 'key' ? '`key`' : column)).join(', ')}) VALUES (${placeholders})`;

    for (const row of rows) {
      await this.run(
        sql,
        columns.map((column) => {
          const value = row[column];
          if (typeof value === 'boolean') {
            return value ? 1 : 0;
          }
          return value ?? null;
        })
      );
    }
  }
}

export const db = new DatabaseManager();
