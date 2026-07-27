import mysql from 'mysql2/promise';
import { config } from '../config/index.js';
import {
  categoryExperienceAnswers,
  EXPERIENCE_CATEGORY_ID,
  experienceAnswers,
} from './experienceAnswers.js';

const isApply = process.argv.includes('--apply');
const expectedQuestionCount = Object.keys(experienceAnswers).length;
const placeholderPattern = /当前题目：|待填写：|这是一道个人经历题，题库不能替你虚构经历/;

async function main() {
  if (config.database.type !== 'mysql') {
    throw new Error('此修订脚本只允许在当前 MySQL/MariaDB 题库上执行');
  }

  const connection = await mysql.createConnection({
    host: config.database.mysql.host,
    port: config.database.mysql.port,
    user: config.database.mysql.user,
    password: config.database.mysql.password,
    database: config.database.mysql.database,
    charset: 'utf8mb4',
  });

  try {
    const ids = Object.keys(experienceAnswers);
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT id, title, answer, category_id
       FROM questions
       WHERE id IN (${placeholders})
       ORDER BY id`,
      ids,
    );

    if (rows.length !== expectedQuestionCount) {
      throw new Error(`安全检查失败：预期 ${expectedQuestionCount} 道经历题，实际找到 ${rows.length} 道`);
    }

    const categoryQuestionIds = new Set(Object.keys(categoryExperienceAnswers));
    const wrongCategory = rows.filter(
      (row) => categoryQuestionIds.has(String(row.id)) && row.category_id !== EXPERIENCE_CATEGORY_ID,
    );
    if (wrongCategory.length > 0) {
      throw new Error(`安全检查失败：经历题分类不一致：${wrongCategory.map((row) => row.id).join(', ')}`);
    }

    const proposed = rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      oldAnswer: String(row.answer || ''),
      newAnswer: experienceAnswers[String(row.id)],
    }));

    const summary = {
      mode: isApply ? 'apply' : 'dry-run',
      total: proposed.length,
      changed: proposed.filter((item) => item.oldAnswer !== item.newAnswer).length,
      placeholdersBefore: proposed.filter((item) => placeholderPattern.test(item.oldAnswer)).length,
      placeholdersAfter: proposed.filter((item) => placeholderPattern.test(item.newAnswer)).length,
      questions: proposed.map((item) => ({ id: item.id, title: item.title })),
    };

    if (!isApply) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      return;
    }

    await connection.beginTransaction();
    try {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      for (const item of proposed) {
        const [result] = await connection.execute<mysql.ResultSetHeader>(
          `UPDATE questions
           SET answer = ?, updated_at = ?
           WHERE id = ?`,
          [item.newAnswer, now, item.id],
        );
        if (result.affectedRows !== 1) {
          throw new Error(`更新题目失败：${item.id}`);
        }
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
