import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user
  const hashedPassword = await bcrypt.hash('Demo123!', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@speakbetter.com' },
    update: {},
    create: {
      email: 'demo@speakbetter.com',
      passwordHash: hashedPassword,
      name: 'Demo User',
      profile: {
        create: {
          nativeLanguage: 'en',
          learningLanguages: ['en', 'es'],
          interests: ['Language Learning', 'Travel'],
          goals: ['Become fluent in Spanish'],
          bio: 'I love learning languages!',
        },
      },
      settings: {
        create: {},
      },
    },
  });

  console.log(`✅ Demo user created: demo@speakbetter.com / Demo123!`);
  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
