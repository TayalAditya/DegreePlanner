import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseSize() {
  try {
    // Get database size
    const sizeResult = await prisma.$queryRaw<Array<{ size: string }>>`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `;
    
    console.log('\n📊 Database Size:', sizeResult[0].size);
    
    // Get table sizes
    const tableSizes = await prisma.$queryRaw<Array<{ 
      table_name: string; 
      size: string;
      row_count: bigint;
    }>>`
      SELECT 
        schemaname || '.' || tablename as table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        n_tup_ins - n_tup_del as row_count
      FROM pg_tables t
      LEFT JOIN pg_stat_user_tables s ON t.tablename = s.relname
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    `;
    
    console.log('\n📋 Top Tables by Size:');
    tableSizes.forEach(t => {
      console.log(`  ${t.table_name.padEnd(30)} ${t.size.padEnd(10)} ${t.row_count} rows`);
    });
    
    // Get free tier limit info
    console.log('\n💡 Neon Free Tier Limit: 0.5 GB (512 MB)');
    
  } catch (error) {
    console.error('Error checking database size:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseSize();
