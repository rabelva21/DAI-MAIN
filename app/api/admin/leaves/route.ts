import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    // 1. Await params (Wajib untuk Next.js 15+)
    const params = await props.params;
    const requestIdToDelete = params.id;

    const session = await auth();

    // 2. Otorisasi: Hanya HRD yang diizinkan
    if (!session?.user || session.user.role !== 'HRD') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Gunakan Transaction agar aman (Database Atomic)
        await prisma.$transaction(async (tx) => {
            // A. Cari data cuti dulu sebelum dihapus untuk pengecekan
            const leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: requestIdToDelete },
            });

            if (!leaveRequest) {
                throw new Error("Data cuti tidak ditemukan");
            }

            // B. Logika Refund: Jika status APPROVED & tipe ANNUAL, kembalikan jatah cuti user
            if (leaveRequest.status === 'APPROVED' && leaveRequest.leaveType === 'ANNUAL') {
                await tx.user.update({
                    where: { id: leaveRequest.employeeId },
                    data: {
                        remainingLeave: {
                            increment: leaveRequest.daysTaken // Kembalikan jumlah hari
                        }
                    }
                });
            }

            // C. Hapus Data Cuti Permanen (Hard Delete)
            await tx.leaveRequest.delete({
                where: { id: requestIdToDelete },
            });
        });

        return NextResponse.json({ message: 'Catatan cuti berhasil dihapus permanen dan kuota telah disesuaikan (jika perlu).' }, { status: 200 });

    } catch (error: any) {
        console.error("Delete Error:", error); // Log error agar terlihat di terminal
        
        // Handle jika ID tidak ketemu
        if (error.message === "Data cuti tidak ditemukan") {
            return NextResponse.json({ error: 'Data tidak ditemukan.' }, { status: 404 });
        }

        return NextResponse.json({ error: 'Gagal menghapus catatan cuti.' }, { status: 500 });
    }
}