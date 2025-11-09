import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic'; // <-- TAMBAHKAN BARIS INI

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'EMPLOYEE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { requestId }: { requestId: string } = await request.json();
  const userId = session.user.id;

  try {
    const leaveRequest = await prisma.leaveRequest.findFirst({
      where: {
        id: requestId,
        employeeId: userId, // Pastikan karyawan hanya bisa batalkan punya sendiri
      },
    });

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Request not found or unauthorized' },
        { status: 404 }
      );
    }

    // Karyawan hanya bisa membatalkan jika status masih 'PENDING'
    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Hanya pengajuan "Menunggu" yang bisa dibatalkan' },
        { status: 400 }
      );
    }

    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}