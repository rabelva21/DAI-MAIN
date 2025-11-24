import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

// --- FITUR DELETE (HAPUS) ---
export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const params = await props.params; // Await params untuk Next.js 15
  
  if (!session?.user || session.user.role !== 'HRD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.leaveRequest.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ message: 'Berhasil dihapus' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal menghapus' }, { status: 500 });
  }
}

// --- FITUR PATCH (REVIEW/APPROVAL) ---
export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const params = await props.params; // Await params
  
  if (!session?.user || session.user.role !== 'HRD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { newStatus, hrdComment } = await request.json();

  try {
    await prisma.$transaction(async (tx) => {
      const updatedLeave = await tx.leaveRequest.update({
        where: { id: params.id },
        data: {
          status: newStatus,
          hrdComment: hrdComment,
          hrdCommentById: session.user.id,
          updatedAt: new Date(),
        },
      });

      // Logika Pengurangan Jatah Cuti (Jika Disetujui & Cuti Tahunan)
      if (newStatus === 'APPROVED' && updatedLeave.leaveType === 'ANNUAL') {
        await tx.user.update({
          where: { id: updatedLeave.employeeId },
          data: { remainingLeave: { decrement: updatedLeave.daysTaken } },
        });
      }
      
      // Logika Refund (Jika tadinya APPROVED lalu diubah jadi REJECTED)
      // (Opsional: tambahkan jika diperlukan)
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error updating' }, { status: 500 });
  }
}