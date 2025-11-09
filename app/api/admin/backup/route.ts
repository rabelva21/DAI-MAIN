import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'HRD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Ambil semua data dari database
    const users = await prisma.user.findMany();
    const departments = await prisma.department.findMany();
    const leaveRequests = await prisma.leaveRequest.findMany();

    const backupData = {
      exportedAt: new Date().toISOString(),
      users,
      departments,
      leaveRequests,
    };

    // 2. Buat nama file dengan timestamp
    const fileName = `dai_backup_${new Date().toISOString().split('T')[0]}.json`;

    // 3. Kembalikan sebagai file JSON untuk diunduh
    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}