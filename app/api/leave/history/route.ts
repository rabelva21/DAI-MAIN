// app/api/leave/history/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
// Hapus atau abaikan import { auth }
// import { auth } from '@/auth'; 
import jwt from 'jsonwebtoken'; // <<< TAMBAHKAN INI

export const dynamic = 'force-dynamic';

// Secret Key Anda (Wajib sama dengan yang di .env)
const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 


export async function GET(request: Request) {
    
    // --- PERBAIKAN 1: OTORISASI JWT MANUAL (Menggantikan await auth()) ---
    const authorizationHeader = request.headers.get('authorization');
    const token = authorizationHeader?.split(' ')[1]; 
    
    if (!token) {
        return NextResponse.json({ error: 'Token tidak tersedia.' }, { status: 401 });
    }

    let userId: string;
    let userRole: string;
    
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId; 
        userRole = decoded.role;
    } catch (e) {
        return NextResponse.json({ error: 'Token Akses tidak valid.' }, { status: 401 });
    }
    
    // Verifikasi Role Karyawan (Role Otorisasi untuk Endpoint ini)
    if (userRole !== 'EMPLOYEE') {
        return NextResponse.json({ error: 'Akses ditolak: Hanya untuk Karyawan.' }, { status: 403 });
    }
    // --- AKHIR PERBAIKAN OTORISASI ---

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const skip = (page - 1) * limit;
    // userId diambil dari Token

    try {
        // whereClause menggunakan userId yang diambil dari Token
        const whereClause = { employeeId: userId }; 

        // Menggunakan Prisma Transaction untuk pagination dan total count
        const [leaveRequests, totalCount] = await prisma.$transaction([
            prisma.leaveRequest.findMany({
                where: whereClause,
                orderBy: {
                    createdAt: 'desc',
                },
                include: {
                    hrdCommentBy: {
                        select: { fullName: true },
                    },
                },
                skip: skip,
                take: limit,
            }),
            prisma.leaveRequest.count({
                where: whereClause,
            }),
        ]);

        return NextResponse.json({
            data: leaveRequests,
            totalCount: totalCount,
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}