// app/api/admin/leaves/[id]/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  
  // 1. Cek Otorisasi (Hanya HRD/Admin)
  if (!session?.user || session.user.role !== 'HRD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Hapus data dari database berdasarkan ID
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
      { error: 'Gagal menghapus data' },
      { status: 500 }
    );
  }
}