/**
 * Development seed data for hierarchical permission system
 * Creates example hierarchy and test users for development and testing
 */

import bcrypt from 'bcrypt';
import { db } from '../connection';

interface HierarchyNode {
  id: string;
  name: string;
  code: string;
  description: string;
  parentId?: string;
  level: number;
  metadata?: any;
}

interface TestUser {
  id: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  baseHierarchyId: string;
  metadata?: any;
}

interface TestPermission {
  userId: string;
  hierarchyId: string;
  role: 'read' | 'manager' | 'admin';
  inheritToDescendants: boolean;
  grantedBy: string;
  expiresAt?: string;
  metadata?: any;
}

class DevSeeder {
  private readonly SALT_ROUNDS = 12;

  /**
   * Clear all existing data from tables
   */
  private async clearExistingData(): Promise<void> {
    console.log('🧹 Clearing existing data...');
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Delete in order due to foreign key constraints
      await client.query('DELETE FROM permissions');
      await client.query('DELETE FROM users');
      await client.query('DELETE FROM hierarchy_structures');
      await client.query('DELETE FROM migrations_log WHERE migration_name LIKE \'%seed%\'');
      
      await client.query('COMMIT');
      console.log('✅ Data cleared successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to clear data:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create hierarchy structure matching the specification
   */
  private async createHierarchyStructure(): Promise<void> {
    console.log('🏗️  Creating hierarchy structure...');
    
    const hierarchies: HierarchyNode[] = [
      // National level (root)
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Australia',
        code: 'australia',
        description: 'National level - Australia',
        level: 0,
        metadata: { 
          level: 'national',
          country_code: 'AU',
          population: 25_600_000
        }
      },
      
      // City level
      {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Sydney',
        code: 'sydney',
        description: 'New South Wales - Sydney Metropolitan Area',
        parentId: '00000000-0000-0000-0000-000000000001',
        level: 1,
        metadata: { 
          level: 'city',
          state: 'NSW',
          population: 5_300_000,
          timezone: 'Australia/Sydney'
        }
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Melbourne',
        code: 'melbourne',
        description: 'Victoria - Melbourne Metropolitan Area',
        parentId: '00000000-0000-0000-0000-000000000001',
        level: 1,
        metadata: { 
          level: 'city',
          state: 'VIC',
          population: 5_100_000,
          timezone: 'Australia/Melbourne'
        }
      },
      
      // Sydney suburbs
      {
        id: '00000000-0000-0000-0000-000000000004',
        name: 'Bondi',
        code: 'bondi',
        description: 'Sydney Eastern Suburbs - Bondi',
        parentId: '00000000-0000-0000-0000-000000000002',
        level: 2,
        metadata: { 
          level: 'suburb',
          postcode: '2026',
          region: 'Eastern Suburbs',
          beach_access: true
        }
      },
      {
        id: '00000000-0000-0000-0000-000000000005',
        name: 'Manly',
        code: 'manly',
        description: 'Sydney Northern Beaches - Manly',
        parentId: '00000000-0000-0000-0000-000000000002',
        level: 2,
        metadata: { 
          level: 'suburb',
          postcode: '2095',
          region: 'Northern Beaches',
          ferry_terminal: true
        }
      },
      {
        id: '00000000-0000-0000-0000-000000000006',
        name: 'Parramatta',
        code: 'parramatta',
        description: 'Sydney Western Suburbs - Parramatta CBD',
        parentId: '00000000-0000-0000-0000-000000000002',
        level: 2,
        metadata: { 
          level: 'suburb',
          postcode: '2150',
          region: 'Western Sydney',
          business_district: true
        }
      },
      
      // Melbourne suburbs
      {
        id: '00000000-0000-0000-0000-000000000007',
        name: 'St Kilda',
        code: 'st_kilda',
        description: 'Melbourne Bayside - St Kilda',
        parentId: '00000000-0000-0000-0000-000000000003',
        level: 2,
        metadata: { 
          level: 'suburb',
          postcode: '3182',
          region: 'Bayside',
          beach_access: true,
          entertainment_district: true
        }
      },
      {
        id: '00000000-0000-0000-0000-000000000008',
        name: 'Richmond',
        code: 'richmond',
        description: 'Melbourne Inner East - Richmond',
        parentId: '00000000-0000-0000-0000-000000000003',
        level: 2,
        metadata: { 
          level: 'suburb',
          postcode: '3121',
          region: 'Inner East',
          sports_precinct: true
        }
      }
    ];

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      for (const hierarchy of hierarchies) {
        await client.query(`
          INSERT INTO hierarchy_structures (id, name, code, description, parent_id, level, metadata, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          hierarchy.id,
          hierarchy.name,
          hierarchy.code,
          hierarchy.description,
          hierarchy.parentId || null,
          hierarchy.level,
          JSON.stringify(hierarchy.metadata || {}),
          true
        ]);
        
        console.log(`  ✅ Created hierarchy: ${hierarchy.name}`);
      }
      
      await client.query('COMMIT');
      console.log('🏗️  Hierarchy structure created successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to create hierarchy structure:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create test users with hashed passwords
   */
  private async createTestUsers(): Promise<void> {
    console.log('👥 Creating test users...');
    
    const users: TestUser[] = [
      // National admin
      {
        id: '10000000-0000-0000-0000-000000000001',
        email: 'admin@australia.gov.au',
        password: 'SecurePass123!',
        fullName: 'National Administrator',
        phone: '+61400000001',
        baseHierarchyId: '00000000-0000-0000-0000-000000000001',
        metadata: { 
          role: 'national_admin',
          department: 'Digital Transformation Agency',
          clearance_level: 'top_secret'
        }
      },
      
      // Sydney city manager
      {
        id: '10000000-0000-0000-0000-000000000002',
        email: 'manager@sydney.nsw.gov.au',
        password: 'SydneyManager2024!',
        fullName: 'Sydney City Manager',
        phone: '+61400000002',
        baseHierarchyId: '00000000-0000-0000-0000-000000000002',
        metadata: { 
          role: 'city_manager',
          department: 'Sydney City Council',
          region: 'NSW'
        }
      },
      
      // Melbourne city manager
      {
        id: '10000000-0000-0000-0000-000000000003',
        email: 'manager@melbourne.vic.gov.au',
        password: 'MelbManager2024!',
        fullName: 'Melbourne City Manager',
        phone: '+61400000003',
        baseHierarchyId: '00000000-0000-0000-0000-000000000003',
        metadata: { 
          role: 'city_manager',
          department: 'Melbourne City Council',
          region: 'VIC'
        }
      },
      
      // Bondi local staff
      {
        id: '10000000-0000-0000-0000-000000000004',
        email: 'staff@bondi.nsw.gov.au',
        password: 'BondiStaff2024!',
        fullName: 'Bondi Local Staff',
        phone: '+61400000004',
        baseHierarchyId: '00000000-0000-0000-0000-000000000004',
        metadata: { 
          role: 'local_staff',
          department: 'Waverley Council',
          specialization: 'beach_safety'
        }
      },
      
      // Manly local staff
      {
        id: '10000000-0000-0000-0000-000000000005',
        email: 'staff@manly.nsw.gov.au',
        password: 'ManlyStaff2024!',
        fullName: 'Manly Local Staff',
        phone: '+61400000005',
        baseHierarchyId: '00000000-0000-0000-0000-000000000005',
        metadata: { 
          role: 'local_staff',
          department: 'Northern Beaches Council',
          specialization: 'ferry_operations'
        }
      },
      
      // St Kilda local staff
      {
        id: '10000000-0000-0000-0000-000000000006',
        email: 'staff@stkilda.vic.gov.au',
        password: 'StKildaStaff2024!',
        fullName: 'St Kilda Local Staff',
        phone: '+61400000006',
        baseHierarchyId: '00000000-0000-0000-0000-000000000007',
        metadata: { 
          role: 'local_staff',
          department: 'Port Phillip Council',
          specialization: 'events_management'
        }
      },
      
      // Test user for permissions testing
      {
        id: '10000000-0000-0000-0000-000000000007',
        email: 'test@example.com',
        password: 'TestUser2024!',
        fullName: 'Test User',
        baseHierarchyId: '00000000-0000-0000-0000-000000000004',
        metadata: { 
          role: 'test_user',
          purpose: 'development_testing'
        }
      }
    ];

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      for (const user of users) {
        const passwordHash = await bcrypt.hash(user.password, this.SALT_ROUNDS);
        
        await client.query(`
          INSERT INTO users (id, email, password_hash, full_name, phone, base_hierarchy_id, metadata, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          user.id,
          user.email,
          passwordHash,
          user.fullName,
          user.phone || null,
          user.baseHierarchyId,
          JSON.stringify(user.metadata || {}),
          true
        ]);
        
        console.log(`  ✅ Created user: ${user.fullName} (${user.email})`);
      }
      
      await client.query('COMMIT');
      console.log('👥 Test users created successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to create test users:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create test permissions demonstrating the hierarchical system
   */
  private async createTestPermissions(): Promise<void> {
    console.log('🔐 Creating test permissions...');
    
    const permissions: TestPermission[] = [
      // National admin has admin access to everything (inheritable)
      {
        userId: '10000000-0000-0000-0000-000000000001',
        hierarchyId: '00000000-0000-0000-0000-000000000001',
        role: 'admin',
        inheritToDescendants: true,
        grantedBy: '10000000-0000-0000-0000-000000000001',
        metadata: { 
          reason: 'national_administrator_privileges',
          granted_at_setup: true
        }
      },
      
      // Sydney manager has manager access to Sydney and descendants
      {
        userId: '10000000-0000-0000-0000-000000000002',
        hierarchyId: '00000000-0000-0000-0000-000000000002',
        role: 'manager',
        inheritToDescendants: true,
        grantedBy: '10000000-0000-0000-0000-000000000001',
        metadata: { 
          reason: 'city_manager_delegation',
          department_authorization: 'sydney_city_council'
        }
      },
      
      // Melbourne manager has manager access to Melbourne and descendants
      {
        userId: '10000000-0000-0000-0000-000000000003',
        hierarchyId: '00000000-0000-0000-0000-000000000003',
        role: 'manager',
        inheritToDescendants: true,
        grantedBy: '10000000-0000-0000-0000-000000000001',
        metadata: { 
          reason: 'city_manager_delegation',
          department_authorization: 'melbourne_city_council'
        }
      },
      
      // Bondi staff has read access only to Bondi (non-inheritable)
      {
        userId: '10000000-0000-0000-0000-000000000004',
        hierarchyId: '00000000-0000-0000-0000-000000000004',
        role: 'read',
        inheritToDescendants: false,
        grantedBy: '10000000-0000-0000-0000-000000000002',
        metadata: { 
          reason: 'local_staff_access',
          employment_verification: 'waverley_council_verified'
        }
      },
      
      // Manly staff has read access only to Manly (non-inheritable)
      {
        userId: '10000000-0000-0000-0000-000000000005',
        hierarchyId: '00000000-0000-0000-0000-000000000005',
        role: 'read',
        inheritToDescendants: false,
        grantedBy: '10000000-0000-0000-0000-000000000002',
        metadata: { 
          reason: 'local_staff_access',
          employment_verification: 'northern_beaches_council_verified'
        }
      },
      
      // St Kilda staff has read access only to St Kilda (non-inheritable)
      {
        userId: '10000000-0000-0000-0000-000000000006',
        hierarchyId: '00000000-0000-0000-0000-000000000007',
        role: 'read',
        inheritToDescendants: false,
        grantedBy: '10000000-0000-0000-0000-000000000003',
        metadata: { 
          reason: 'local_staff_access',
          employment_verification: 'port_phillip_council_verified'
        }
      },
      
      // Test user has temporary manager access to Bondi (expires in 30 days)
      {
        userId: '10000000-0000-0000-0000-000000000007',
        hierarchyId: '00000000-0000-0000-0000-000000000004',
        role: 'manager',
        inheritToDescendants: false,
        grantedBy: '10000000-0000-0000-0000-000000000002',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { 
          reason: 'temporary_project_access',
          project: 'bondi_beach_modernization',
          expiry_reason: 'project_completion'
        }
      },
      
      // Test user also has read access to Melbourne (cross-region access)
      {
        userId: '10000000-0000-0000-0000-000000000007',
        hierarchyId: '00000000-0000-0000-0000-000000000003',
        role: 'read',
        inheritToDescendants: true,
        grantedBy: '10000000-0000-0000-0000-000000000001',
        metadata: { 
          reason: 'inter_city_coordination',
          project: 'national_beach_safety_standards'
        }
      }
    ];

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      for (const permission of permissions) {
        await client.query(`
          INSERT INTO permissions (
            user_id, hierarchy_id, role, inherit_to_descendants, 
            granted_by, expires_at, metadata, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          permission.userId,
          permission.hierarchyId,
          permission.role,
          permission.inheritToDescendants,
          permission.grantedBy,
          permission.expiresAt || null,
          JSON.stringify(permission.metadata || {}),
          true
        ]);
        
        console.log(`  ✅ Created permission: ${permission.role} for user ${permission.userId} on hierarchy ${permission.hierarchyId}`);
      }
      
      await client.query('COMMIT');
      console.log('🔐 Test permissions created successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Failed to create test permissions:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Log seed operation completion
   */
  private async logSeedCompletion(): Promise<void> {
    const client = await db.getClient();
    
    try {
      await client.query(`
        INSERT INTO migrations_log (migration_name, execution_time_ms, success)
        VALUES ($1, $2, $3)
        ON CONFLICT (migration_name) DO UPDATE SET
          executed_at = CURRENT_TIMESTAMP,
          execution_time_ms = EXCLUDED.execution_time_ms,
          success = EXCLUDED.success
      `, ['dev-seed', 0, true]);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('⚠️  Could not log seed completion:', errorMessage);
    } finally {
      client.release();
    }
  }

  /**
   * Run the complete seeding process
   */
  public async seedDatabase(): Promise<void> {
    const startTime = Date.now();
    console.log('🌱 Starting development database seeding...\n');
    
    try {
      // Test database connection first
      const connected = await db.testConnection();
      if (!connected) {
        throw new Error('Cannot connect to database. Please check your DATABASE_URL.');
      }

      await this.clearExistingData();
      await this.createHierarchyStructure();
      await this.createTestUsers();
      await this.createTestPermissions();
      await this.logSeedCompletion();
      
      const executionTime = Date.now() - startTime;
      console.log(`\n🎉 Database seeding completed successfully! (${executionTime}ms)`);
      console.log('\n📊 Summary:');
      console.log('  • 8 hierarchy structures created (1 national, 2 cities, 5 suburbs)');
      console.log('  • 7 test users created with bcrypt hashed passwords');
      console.log('  • 8 permission relationships established');
      console.log('\n🔑 Test credentials:');
      console.log('  • National Admin: admin@australia.gov.au / SecurePass123!');
      console.log('  • Sydney Manager: manager@sydney.nsw.gov.au / SydneyManager2024!');
      console.log('  • Melbourne Manager: manager@melbourne.vic.gov.au / MelbManager2024!');
      console.log('  • Test User: test@example.com / TestUser2024!');
      
    } catch (error) {
      console.error('\n💥 Database seeding failed:', error);
      throw error;
    }
  }

  /**
   * Show current database status after seeding
   */
  public async showStatus(): Promise<void> {
    console.log('\n📋 Database Status After Seeding\n');
    
    const client = await db.getClient();
    
    try {
      // Show hierarchy structure
      const hierarchyResult = await client.query(`
        SELECT 
          name,
          description,
          CASE 
            WHEN parent_id IS NULL THEN '🌍'
            WHEN depth = 1 THEN '🏙️'
            ELSE '🏘️'
          END as icon,
          depth,
          REPEAT('  ', depth) || name as indented_name
        FROM hierarchy_structures 
        WHERE is_active = true
        ORDER BY path
      `);
      
      console.log('🏗️  Hierarchy Structure:');
      for (const row of hierarchyResult.rows) {
        console.log(`  ${row.icon} ${row.indented_name}`);
      }

      // Show users by hierarchy
      const usersResult = await client.query(`
        SELECT 
          u.full_name,
          u.email,
          h.name as hierarchy_name,
          COUNT(p.id) as permission_count
        FROM users u
        JOIN hierarchy_structures h ON u.base_hierarchy_id = h.id
        LEFT JOIN active_permissions p ON u.id = p.user_id
        WHERE u.is_active = true
        GROUP BY u.id, u.full_name, u.email, h.name
        ORDER BY h.depth, u.full_name
      `);
      
      console.log('\n👥 Users and Permissions:');
      for (const row of usersResult.rows) {
        console.log(`  👤 ${row.full_name} (${row.email})`);
        console.log(`     📍 Base: ${row.hierarchy_name}`);
        console.log(`     🔐 Permissions: ${row.permission_count}`);
        console.log('');
      }

      // Show permission overview
      const permissionResult = await client.query(`
        SELECT 
          role,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE inherit_to_descendants = true) as inheritable_count
        FROM active_permissions
        GROUP BY role
        ORDER BY 
          CASE role 
            WHEN 'admin' THEN 1 
            WHEN 'manager' THEN 2 
            WHEN 'read' THEN 3 
          END
      `);
      
      console.log('🔐 Permission Summary:');
      for (const row of permissionResult.rows) {
        console.log(`  ${row.role}: ${row.count} total (${row.inheritable_count} inheritable)`);
      }

    } finally {
      client.release();
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const seeder = new DevSeeder();

  try {
    switch (command) {
      case 'seed':
      case undefined:
        await seeder.seedDatabase();
        await seeder.showStatus();
        break;
      
      case 'status':
        await seeder.showStatus();
        break;
      
      default:
        console.log('Usage: npm run seed [command]');
        console.log('Commands:');
        console.log('  seed (default) - Clear and populate database with development data');
        console.log('  status         - Show current database status');
        process.exit(1);
    }

    console.log('\n🎯 Seeding task completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n💥 Seeding failed:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { DevSeeder };

// Run if called directly
if (require.main === module) {
  main();
}