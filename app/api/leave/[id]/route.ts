// app/api/leave/[id]/route.ts (Cleaned GET/Read only)

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

// Fungsi utama: Mengambil detail pengajuan cuti berdasarkan ID
export async function GET(
  request: Request,
  // Menggunakan tipe data yang benar untuk Next.js 15
  props: { params: { id: string } }
) {
  const { id } = props.params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { 
        employee: { 
            select: { id: true, fullName: true, email: true, remainingLeave: true } 
        },
        hrdCommentBy: { 
            select: { fullName: true } 
        },
        department: { select: { name: true } },
      }
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Pengajuan tidak ditemukan' }, { status: 404 });
    }

    // Otorisasi: Hanya HRD atau pemilik pengajuan yang boleh melihat
    if (session.user.role !== 'HRD' && leaveRequest.employee?.id !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(leaveRequest, { status: 200 });
  } catch (error) {
    console.error("GET Leave Error:", error);
    return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
  }
}