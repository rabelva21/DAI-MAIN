import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// Pastikan route ini dinamis
export const dynamic = 'force-dynamic';

// ... (Kode GET atau PATCH/PUT yang sudah ada biarkan saja di atas sini) ...

// --- PERBAIKAN PADA FUNGSI DELETE ---
export async function DELETE(
  request: Request,
  // PERUBAHAN DISINI: Tipe params diubah menjadi Promise
  props: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  
  // PERUBAHAN DISINI: Kita harus await props.params terlebih dahulu
  const params = await props.params;
  const requestId = params.id;

  // 1. Otorisasi: Hanya Admin/HRD
  if (!session?.user || session.user.role !== 'HRD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Cek apakah data ada
    const existingRequest = await prisma.leaveRequest.findUnique({
        where: { id: requestId }
    });

    if (!existingRequest) {
        return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
    }

    // 3. Proses Hapus Data Permanen
    await prisma.leaveRequest.delete({
      where: { id: requestId },
    });

    return NextResponse.json(
      { message: 'Data berhasil dihapus permanen.' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Delete error:", error);
    
    // Handle error spesifik Prisma jika record tidak ditemukan (P2025)
    if (error.code === 'P2025') {
        return NextResponse.json(
            { error: 'Pengajuan cuti tidak ditemukan.' },
            { status: 404 }
        );
    }

    return NextResponse.json(
      { error: 'Gagal menghapus data. Pastikan data tidak terkait dengan relasi lain yang vital.' },
      { status: 500 }
    );
  }
}