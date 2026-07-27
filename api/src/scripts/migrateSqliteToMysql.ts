import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import { DatabaseManager } from '../database/index.js';
import { DatabaseConnectionConfig } from '../types/index.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const sourceInputPath = required('SOURCE_SQLITE_PATH');
  const sourcePath = `/tmp/tech-growth-hub-migration-${process.pid}.sqlite`;
  fs.copyFileSync(sourceInputPath, sourcePath);
  const targetConfig: DatabaseConnectionConfig = {
    type: 'mysql',
    sqlite: { path: sourcePath },
    mysql: {
      host: process.env.MYSQL_HOST || 'db',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || 'tech_growth_hub',
      password: required('MYSQL_PASSWORD'),
      database: process.env.MYSQL_DATABASE || 'tech_growth_hub',
    },
  };
  const sourceConfig: DatabaseConnectionConfig = {
    ...targetConfig,
    type: 'sqlite',
    sqlite: { path: sourcePath },
  };

  const source = new DatabaseManager(sourceConfig, { skipDefaultAdmin: true });
  const target = new DatabaseManager(targetConfig, { skipDefaultAdmin: true });
  try {
    await source.connect();
    await target.connect();
    const dataset = await source.exportAllData();

    const adminUsername = process.env.MIGRATE_ADMIN_USERNAME?.trim();
    const adminPassword = process.env.MIGRATE_ADMIN_PASSWORD;
    if (adminUsername && adminPassword) {
      const sourceAdmin = dataset.users.find((user) => user.role === 'admin') || dataset.users[0];
      if (!sourceAdmin) throw new Error('Source database does not contain a user to migrate');
      const usernameConflict = dataset.users.find((user) => user !== sourceAdmin && user.username === adminUsername);
      if (usernameConflict) throw new Error(`Cannot rename source admin: username ${adminUsername} already exists`);
      sourceAdmin.username = adminUsername;
      sourceAdmin.email = process.env.MIGRATE_ADMIN_EMAIL?.trim() || sourceAdmin.email || 'admin@localhost';
      sourceAdmin.password_hash = await bcrypt.hash(adminPassword, 12);
      sourceAdmin.must_change_password = 1;
      sourceAdmin.role = 'admin';
    }

    await target.replaceAllData(dataset);
    const sourceCounts = await source.getTableCounts();
    const targetCounts = await target.getTableCounts();
    const matches = Object.keys(sourceCounts).every((key) => (
      sourceCounts[key as keyof typeof sourceCounts] === targetCounts[key as keyof typeof targetCounts]
    ));
    console.log(JSON.stringify({ matches, source: sourceCounts, target: targetCounts }));
    if (!matches) process.exitCode = 2;
  } finally {
    await Promise.allSettled([source.close(), target.close()]);
    fs.rmSync(sourcePath, { force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
