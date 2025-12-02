// app/api/leave/history/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth'; 
import jwt from 'jsonwebtoken'; 

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 

export async function GET(request: Request) {
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
        return NextResponse.json({ error: 'Unauthorized: Harap login.' }, { status: 401 });
    }
    
    if (userRole !== 'EMPLOYEE') {
        return NextResponse.json({ error: 'Akses ditolak: Hanya untuk Karyawan.' }, { status: 403 });
    }

    // --- LOGIKA PENGAMBILAN DATA ---
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const skip = (page - 1) * limit;

    try {
        const whereClause = { employeeId: userId }; 

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
        console.error("History API Error:", error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}