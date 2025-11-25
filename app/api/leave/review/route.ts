// app/api/leave/review/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Hapus atau abaikan import { auth }
// import { auth } from '@/auth'; 
import { LeaveStatus } from '@prisma/client';
// >>> TAMBAHKAN IMPORT JWT MANUAL <<<
import jwt from 'jsonwebtoken'; 

export const dynamic = 'force-dynamic';


const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 

export async function PUT(request: Request) {
    // >>> PERBAIKAN 1: BACA TOKEN MANUAL DARI HEADER <<<
    const authorizationHeader = request.headers.get('authorization');
    const token = authorizationHeader?.split(' ')[1];
    
    if (!token) {
        return NextResponse.json({ error: 'Token tidak tersedia.' }, { status: 401 });
    }

    let hrdUserId: string;
    let userRole: string;
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        hrdUserId = decoded.userId; // Ambil userId dari Token untuk hrdCommentById
        userRole = decoded.role; // Ambil role
    } catch (e) {
        return NextResponse.json({ error: 'Token Akses tidak valid.' }, { status: 401 });
    }
    
    // PERBAIKAN 2: Gunakan role dari Token yang sudah di-decode
    if (userRole !== 'HRD') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // >>> AKHIR PERBAIKAN OTORISASI <<<

    const {
        requestId,
        newStatus,
        hrdComment,
    }: {
        requestId: string;
        newStatus: LeaveStatus;
        hrdComment: string;
    } = await request.json();
    // const hrdUserId = session.user.id; // Baris ini digantikan oleh decoded.userId di atas

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
                    hrdCommentById: hrdUserId, // Gunakan hrdUserId dari Token
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