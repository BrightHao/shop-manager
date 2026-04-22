import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

async function seed() {
  console.log('Seeding database...');

  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await hash(adminPassword, 10);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@shop.com'))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(users).values({
      name: 'Admin',
      email: 'admin@shop.com',
      passwordHash,
      role: 'admin',
      status: 'active',
    });
    console.log('Admin user created: admin@shop.com');
  } else {
    console.log('Admin user already exists');
  }

  console.log('Seed complete');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
