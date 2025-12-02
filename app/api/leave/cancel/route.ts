// app/api/leave/cancel/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import jwt from 'jsonwebtoken'; 

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 

export async function PUT(request: Request) {
    let userId: string | undefined;
    let userRole: string | undefined;

    // --- 1. CEK SESSION BROWSER ---
    const session = await auth();
    if (session && session.user) {
        userId = session.user.id;
        userRole = session.user.role;
    }

    // --- 2. JIKA KOSONG, CEK HEADER TOKEN (POSTMAN) ---
    if (!userId) {
        const authorizationHeader = request.headers.get('authorization');
        const token = authorizationHeader?.split(' ')[1]; 
        
        if (token) {
            try {
                const decoded: any = jwt.verify(token, JWT_SECRET);
                userId = decoded.userId; 
                userRole = decoded.role;
            } catch (e) {
                console.error("Token invalid");
            }
        }
    }
    
    // --- 3. VALIDASI FINAL ---
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (userRole !== 'EMPLOYEE') {
        return NextResponse.json({ error: 'Akses ditolak: Hanya untuk Karyawan.' }, { status: 403 });
    }
    
    // --- LOGIKA PEMBATALAN ---
    try {
        const body = await request.json();
        const { requestId } = body; 
        
        if (!requestId) {
             return NextResponse.json({ error: 'ID Pengajuan tidak ditemukan.' }, { status: 400 });
        }
    
        const leaveRequest = await prisma.leaveRequest.findFirst({
            where: {
                id: requestId,
                employeeId: userId, // Pastikan milik user yang login
            },
        });

        if (!leaveRequest) {
            return NextResponse.json(
                { error: 'Pengajuan tidak ditemukan atau bukan milik Anda.' },
                { status: 404 }
            );
        }

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

        return NextResponse.json({ success: true, message: 'Pengajuan berhasil dibatalkan.' }, { status: 200 });
    } catch (error) {
        console.error("Cancel API Error:", error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}