import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { LeaveStatus } from '@prisma/client';

export const dynamic = 'force-dynamic'; // <-- TAMBAHKAN BARIS INI

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'HRD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    requestId,
    newStatus,
    hrdComment,
  }: {
    requestId: string;
    newStatus: LeaveStatus;
    hrdComment: string;
  } = await request.json();
  const hrdUserId = session.user.id;

  try {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const oldStatus = leaveRequest.status;
    const isAnnual = leaveRequest.leaveType === 'ANNUAL';
    const daysTaken = leaveRequest.daysTaken;

    // --- Logika Pengurangan & Pengembalian Jatah Cuti (Fitur II.2) ---
    await prisma.$transaction(async (tx) => {
      // 1. Update status pengajuan cuti
      await tx.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: newStatus,
          hrdComment: hrdComment,
          hrdCommentById: hrdUserId,
          updatedAt: new Date(),
        },
      });

      // 2. Logika Pengurangan Jatah (HANYA jika Disetujui & Cuti Tahunan)
      if (
        newStatus === 'APPROVED' &&
        oldStatus !== 'APPROVED' &&
        isAnnual
      ) {
        await tx.user.update({
          where: { id: leaveRequest.employeeId },
          data: { remainingLeave: { decrement: daysTaken } },
        });
      }

      // 3. Logika Pengembalian Jatah (Refund)
      if (
        oldStatus === 'APPROVED' &&
        newStatus !== 'APPROVED' && // Ditolak atau Dibatalkan
        isAnnual
      ) {
        await tx.user.update({
          where: { id: leaveRequest.employeeId },
          data: { remainingLeave: { increment: daysTaken } },
        });
      }
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