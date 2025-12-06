import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Mereset database...');
  // Hapus data lama (Urutan penting karena relasi)
  // Gunakan try-catch agar tidak error jika tabel kosong
  try { await prisma.leaveApproval.deleteMany(); } catch(e) {}
  try { await prisma.leaveRequest.deleteMany(); } catch(e) {}
  try { await prisma.karyawan.deleteMany(); } catch(e) {}
  try { await prisma.hRD.deleteMany(); } catch(e) {}
  try { await prisma.department.deleteMany(); } catch(e) {}

  // 1. Buat Departemen
  console.log('Membuat Departemen...');
  const engineering = await prisma.department.create({ data: { name: 'Engineering', maxConcurrentLeave: 2 } });
  const hrDept = await prisma.department.create({ data: { name: 'Human Resources', maxConcurrentLeave: 2 } });
  await prisma.department.create({ data: { name: 'Marketing', maxConcurrentLeave: 2 } });
  await prisma.department.create({ data: { name: 'Finance', maxConcurrentLeave: 2 } });
  
  // 2. Buat Akun HRD
  console.log('Membuat Akun HRD...');
  const passwordHrd = await bcrypt.hash('password123', 10);
  await prisma.hRD.create({
    data: {
      email: 'hrd@ptdai.com',
      fullName: 'Hari HRD (Admin)',
      password: passwordHrd,
    },
  });

  // 3. Buat Akun Karyawan
  console.log('Membuat Akun Karyawan...');
  const passwordKaryawan = await bcrypt.hash('password123', 10);
  await prisma.karyawan.create({
    data: {
      email: 'budi@ptdai.com',
      fullName: 'Budi Santoso',
      password: passwordKaryawan,
      departmentId: engineering.id,
      remainingLeave: 12,
    },
  });

  
  console.log('Seeding selesai! ✨');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });