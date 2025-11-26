// app/api/leave/cancel/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken'; 

export const dynamic = 'force-dynamic';

// Secret Key Anda (Wajib sama dengan yang di .env)
const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 


export async function PUT(request: Request) {
    
    // --- START: OTORISASI JWT MANUAL ---
    const authorizationHeader = request.headers.get('authorization');
    const token = authorizationHeader?.split(' ')[1]; 
    
    if (!token) {
        return NextResponse.json({ error: 'Token tidak tersedia.' }, { status: 401 });
    }

    let userId: string;
    
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        
        if (decoded.role !== 'EMPLOYEE') {
            return NextResponse.json({ error: 'Akses ditolak: Hanya untuk Karyawan.' }, { status: 403 });
        }
        
        userId = decoded.userId; 
    } catch (e) {
        return NextResponse.json({ error: 'Token Akses tidak valid.' }, { status: 401 });
    }
    // --- AKHIR PERBAIKAN OTORISASI ---
    
    // ----------------------------------------------------
    // PERBAIKAN FOKUS: Menangani Gagal Parsing JSON
    // ----------------------------------------------------
    try {
        const body = await request.json();
        const { requestId } = body as { requestId: string }; // Ambil requestId dari body
        
        if (!requestId) {
             return NextResponse.json({ error: 'ID Pengajuan cuti tidak ditemukan di Body JSON.' }, { status: 400 });
        }
    
        // userId sudah diambil dari token di atas
        
        const leaveRequest = await prisma.leaveRequest.findFirst({
            where: {
                id: requestId,
                employeeId: userId, // Pastikan karyawan hanya bisa batalkan punya sendiri
            },
        });

        if (!leaveRequest) {
            return NextResponse.json(
                { error: 'Pengajuan tidak ditemukan atau bukan milik Anda.' },
                { status: 404 } // 404 Not Found, bukan 400 Bad Request
            );
        }

        // Karyawan hanya bisa membatalkan jika status masih 'PENDING'
        if (leaveRequest.status !== 'PENDING') {
            return NextResponse.json(
                { error: 'Hanya pengajuan "Menunggu" yang bisa dibatalkan' },
                { status: 400 }
            );
        }

        // Soft Delete: Ubah status menjadi 'CANCELLED'
        await prisma.leaveRequest.update({
            where: { id: requestId },
            data: {
                status: 'CANCELLED',
                updatedAt: new Date(),
            },
        });

        return NextResponse.json({ success: true, message: 'Pengajuan berhasil dibatalkan.' }, { status: 200 });
    } catch (error) {
        // Tangani kegagalan parsing JSON (seperti yang sering terjadi)
        if (error instanceof SyntaxError) { 
             return NextResponse.json({ error: 'Body JSON yang dikirim salah format.' }, { status: 400 });
        }
        console.error("PUT Leave Cancel Error:", error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}