import { DataSource } from 'typeorm';
import { User } from '../../modules/auth/entities/user.entity';

const email = process.argv[2];
if (!email) {
  console.error('Usage: ts-node admin.seed.ts <email>');
  process.exit(1);
}

const ds = new DataSource({
  type: 'postgres',
  host:     process.env.SEED_DB_HOST ?? 'localhost',
  port:     parseInt(process.env.SEED_DB_PORT ?? '5433', 10),
  username: process.env.DB_USER      ?? 'mymusic',
  password: process.env.DB_PASSWORD  ?? 'mymusic_password',
  database: process.env.DB_NAME      ?? 'mymusic_db',
  entities: [User],
  synchronize: false,
});

async function seed() {
  await ds.initialize();
  const repo = ds.getRepository(User);

  const user = await repo.findOne({ where: { email } });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const roles = user.roles as string[];
  if (roles.includes('ADMIN')) {
    console.log(`${email} already has ADMIN role.`);
  } else {
    roles.push('ADMIN');
    user.roles = roles as any;
    await repo.save(user);
    console.log(`✓ Granted ADMIN to ${email}  (roles: ${user.roles.join(', ')})`);
  }

  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
