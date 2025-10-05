/**
 * Database migration runner
 * Executes SQL migration files in order and tracks execution
 */

import fs from 'fs';
import path from 'path';
import { db, PoolClient } from './connection';

interface Migration {
  name: string;
  filename: string;
  content: string;
}

class MigrationRunner {
  private migrationsDir: string;

  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  /**
   * Read all migration files from the migrations directory
   */
  private async loadMigrations(): Promise<Migration[]> {
    try {
      const files = fs.readdirSync(this.migrationsDir);
      const sqlFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort(); // Sort alphabetically to ensure correct order

      const migrations: Migration[] = [];

      for (const filename of sqlFiles) {
        const filePath = path.join(this.migrationsDir, filename);
        const content = fs.readFileSync(filePath, 'utf8');
        const name = path.basename(filename, '.sql');
        
        migrations.push({
          name,
          filename,
          content,
        });
      }

      return migrations;
    } catch (error) {
      console.error('❌ Failed to load migrations:', error);
      throw error;
    }
  }

  /**
   * Check if migration has already been executed
   */
  private async hasMigrationBeenExecuted(client: PoolClient, migrationName: string): Promise<boolean> {
    try {
      const result = await client.query(
        'SELECT has_migration_been_executed($1) as executed',
        [migrationName]
      );
      return result.rows[0]?.executed || false;
    } catch (error) {
      // If function doesn't exist yet, migration hasn't been executed
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage?.includes('function has_migration_been_executed') || 
          errorMessage?.includes('relation "migrations_log" does not exist')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Log migration execution
   */
  private async logMigrationExecution(
    client: PoolClient,
    migrationName: string,
    executionTimeMs: number,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    try {
      await client.query(
        'SELECT log_migration_execution($1, $2, $3, $4)',
        [migrationName, executionTimeMs, success, errorMessage]
      );
    } catch (error) {
      // If function doesn't exist yet, we're probably in the first migration
      // This is expected and we'll create the logging table in migration 004
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('⚠️  Could not log migration (expected for early migrations):', errorMessage);
    }
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(client: PoolClient, migration: Migration): Promise<void> {
    const startTime = Date.now();
    console.log(`🔄 Executing migration: ${migration.name}`);

    try {
      await client.query('BEGIN');
      
      // Execute the migration SQL
      await client.query(migration.content);
      
      await client.query('COMMIT');
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ Migration ${migration.name} completed successfully (${executionTime}ms)`);

      // Log the execution
      await this.logMigrationExecution(client, migration.name, executionTime, true);
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Ignore rollback errors
      }
      
      const executionTime = Date.now() - startTime;
      console.error(`❌ Migration ${migration.name} failed:`, error);

      // Try to log the failure
      try {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.logMigrationExecution(client, migration.name, executionTime, false, errorMessage);
      } catch (logError) {
        const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
        console.warn('⚠️  Could not log migration failure:', logErrorMessage);
      }

      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  public async runMigrations(): Promise<void> {
    console.log('🚀 Starting database migration...');

    const migrations = await this.loadMigrations();
    console.log(`📁 Found ${migrations.length} migration files`);

    if (migrations.length === 0) {
      console.log('✅ No migrations to run');
      return;
    }

    const client = await db.getClient();
    
    try {
      let executedCount = 0;
      let skippedCount = 0;

      for (const migration of migrations) {
        const alreadyExecuted = await this.hasMigrationBeenExecuted(client, migration.name);

        if (alreadyExecuted) {
          console.log(`⏭️  Skipping migration: ${migration.name} (already executed)`);
          skippedCount++;
          continue;
        }

        await this.executeMigration(client, migration);
        executedCount++;
      }

      console.log('\n🎉 Migration completed successfully!');
      console.log(`📊 Summary: ${executedCount} executed, ${skippedCount} skipped`);

    } catch (error) {
      console.error('\n💥 Migration failed');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reset database (drop all tables and re-run migrations)
   */
  public async resetDatabase(): Promise<void> {
    console.log('🔥 Resetting database (dropping all tables)...');

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Drop all tables in correct order (reverse of creation due to foreign keys)
      const dropQueries = [
        'DROP TABLE IF EXISTS permissions CASCADE',
        'DROP TABLE IF EXISTS users CASCADE',
        'DROP TABLE IF EXISTS hierarchy_structures CASCADE',
        'DROP TABLE IF EXISTS migrations_log CASCADE',
        'DROP VIEW IF EXISTS active_permissions CASCADE',
        'DROP VIEW IF EXISTS user_access_analysis CASCADE',
        'DROP VIEW IF EXISTS hierarchy_statistics CASCADE',
        'DROP FUNCTION IF EXISTS update_hierarchy_updated_at() CASCADE',
        'DROP FUNCTION IF EXISTS update_users_updated_at() CASCADE',
        'DROP FUNCTION IF EXISTS update_permissions_updated_at() CASCADE',
        'DROP FUNCTION IF EXISTS update_user_last_login(UUID) CASCADE',
        'DROP FUNCTION IF EXISTS revoke_permission(UUID, UUID) CASCADE',
        'DROP FUNCTION IF EXISTS is_permission_expired(permissions) CASCADE',
        'DROP FUNCTION IF EXISTS log_migration_execution(VARCHAR, INTEGER, BOOLEAN, TEXT) CASCADE',
        'DROP FUNCTION IF EXISTS has_migration_been_executed(VARCHAR) CASCADE',
      ];

      for (const query of dropQueries) {
        await client.query(query);
      }

      await client.query('COMMIT');
      console.log('✅ Database reset completed');

      // Now run migrations
      await this.runMigrations();

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Database reset failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Show migration status
   */
  public async showStatus(): Promise<void> {
    console.log('📋 Migration Status\n');

    const migrations = await this.loadMigrations();
    const client = await db.getClient();

    try {
      console.log('Available migrations:');
      for (const migration of migrations) {
        const executed = await this.hasMigrationBeenExecuted(client, migration.name);
        const status = executed ? '✅ Executed' : '⏳ Pending';
        console.log(`  ${status} ${migration.name}`);
      }

      // Try to show execution history
      try {
        const result = await client.query(`
          SELECT migration_name, executed_at, execution_time_ms, success 
          FROM migrations_log 
          ORDER BY executed_at DESC 
          LIMIT 10
        `);

        if (result.rows.length > 0) {
          console.log('\nRecent executions:');
          for (const row of result.rows) {
            const status = row.success ? '✅' : '❌';
            const time = row.execution_time_ms ? `(${row.execution_time_ms}ms)` : '';
            console.log(`  ${status} ${row.migration_name} - ${row.executed_at} ${time}`);
          }
        }
      } catch (error) {
        console.log('\n⚠️  Migration log not available (run migrations first)');
      }

    } finally {
      client.release();
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const runner = new MigrationRunner();

  try {
    // Test database connection first
    const connected = await db.testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to database. Please check your DATABASE_URL.');
      process.exit(1);
    }

    switch (command) {
      case 'run':
      case undefined:
        await runner.runMigrations();
        break;
      
      case 'reset':
        await runner.resetDatabase();
        break;
      
      case 'status':
        await runner.showStatus();
        break;
      
      default:
        console.log('Usage: npm run migrate [command]');
        console.log('Commands:');
        console.log('  run (default) - Run all pending migrations');
        console.log('  reset         - Drop all tables and re-run migrations');
        console.log('  status        - Show migration status');
        process.exit(1);
    }

    console.log('\n🎯 Migration task completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { MigrationRunner };

// Run if called directly
if (require.main === module) {
  main();
}