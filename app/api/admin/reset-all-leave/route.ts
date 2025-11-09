import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic'; // <-- TAMBAHKAN BARIS INI

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'HRD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Mengatur ulang jatah cuti SEMUA karyawan ke 12
    const result = await prisma.user.updateMany({
      where: {
        role: 'EMPLOYEE',
      },
      data: {
        remainingLeave: 12,
      },
    });

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}