import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  await prisma.leaveRequest.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  console.log('Deleted old data.');

  await prisma.department.createMany({
    data: [
      { name: 'Engineering', maxConcurrentLeave: 2 },
      { name: 'Marketing', maxConcurrentLeave: 3 },
      { name: 'Sales', maxConcurrentLeave: 4 },
      { name: 'Finance', maxConcurrentLeave: 2 },
      { name: 'Operations', maxConcurrentLeave: 5 },
      { name: 'Human Resources', maxConcurrentLeave: 2 },
    ],
  });

  console.log('Created 6 departments.');

  const hashedPasswordHrd = await bcrypt.hash('password123', 10);

  const userHrd = await prisma.user.create({
    data: {
      email: 'hrd@ptdai.com',
      fullName: 'Hari HRD',
      password: hashedPasswordHrd,
      role: UserRole.HRD,
      remainingLeave: 12,
      departmentId: null,
    },
  });

  console.log('Created HRD user:');
  console.log(userHrd);
  console.log('Seeding finished. ✨');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });