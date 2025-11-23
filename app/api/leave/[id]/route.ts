// app/api/leave/[id]/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

// Fitur DELETE (Hapus Permanen)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  // 1. Cek Otorisasi (Hanya HRD)
  if (!session?.user || session.user.role !== 'HRD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Hapus data
    await prisma.leaveRequest.delete({
      where: { id: params.id },
    });

    return NextResponse.json(
      { message: 'Data berhasil dihapus' },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete Error:", error);
    return NextResponse.json(
      { error: 'Gagal menghapus data (ID mungkin tidak ditemukan)' },
      { status: 500 }
    );
  }
}