// app/api/admin/leaves/[id]/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Hapus atau abaikan import auth, kita akan menggunakan JWT manual
// import { auth } from '@/auth'; 
import jwt from 'jsonwebtoken'; // <<< TAMBAHKAN INI

// Gunakan Secret Key yang sama dengan yang ada di .env Anda
const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 


export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    // 1. Await params
    const params = await props.params;
    const requestIdToDelete = params.id;

    // >>> START: PERBAIKAN OTORISASI MANUAL <<<
    const authorizationHeader = request.headers.get('authorization');
    const token = authorizationHeader?.split(' ')[1]; // Ambil string Token setelah 'Bearer '
    
    if (!token) {
        return NextResponse.json({ error: 'Token tidak tersedia.' }, { status: 401 });
    }

    let userRole: string;
    try {
        // Verifikasi Token JWT secara manual
        const decoded: any = jwt.verify(token, JWT_SECRET);
        userRole = decoded.role; // Ambil role dari payload Token
    } catch (e) {
        // Token tidak valid (expired, signature mismatch, dll.)
        return NextResponse.json({ error: 'Token Akses tidak valid.' }, { status: 401 });
    }
    
    // 2. Otorisasi: Hanya HRD yang diizinkan (Cek role dari Token yang diverifikasi)
    if (userRole !== 'HRD') {
        return NextResponse.json({ error: 'Akses ditolak: Bukan HRD' }, { status: 403 });
    }
    // >>> END: PERBAIKAN OTORISASI MANUAL <<<

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
                            increment: leaveRequest.daysTaken 
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
        console.error("Delete Error:", error);

        if (error.message === "Data cuti tidak ditemukan") {
            return NextResponse.json({ error: 'Data tidak ditemukan.' }, { status: 404 });
        }

        return NextResponse.json({ error: 'Gagal menghapus catatan cuti.' }, { status: 500 });
    }
}