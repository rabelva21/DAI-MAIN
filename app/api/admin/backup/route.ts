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
    // 1. Ambil semua data dari database (PERBAIKAN: Ambil Karyawan dan HRD terpisah)
    const employees = await prisma.karyawan.findMany();
    const hrds = await prisma.hRD.findMany();
    const departments = await prisma.department.findMany();
    const leaveRequests = await prisma.leaveRequest.findMany();

    const backupData = {
      exportedAt: new Date().toISOString(),
      employees, // Ganti users jadi employees
      hrds,      // Tambahkan HRD
      departments,
      leaveRequests,
    };

    const fileName = `dai_backup_${new Date().toISOString().split('T')[0]}.json`;

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