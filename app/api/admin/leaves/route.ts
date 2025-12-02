import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth'; // Pastikan import auth ada
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 

// --- FUNGSI DELETE (Penghapusan Massal - Hybrid Auth) ---
export async function DELETE(request: Request) {
    let userRole: string | undefined;

    // 1. Cek Session Browser (Web)
    const session = await auth();
    if (session && session.user) {
        userRole = session.user.role;
    }

    // 2. Jika Session Kosong, Cek Token (Postman)
    if (!userRole) {
        const authorizationHeader = request.headers.get('authorization');
        const token = authorizationHeader?.split(' ')[1]; 
        
        if (token) {
            try {
                const decoded: any = jwt.verify(token, JWT_SECRET);
                userRole = decoded.role;
            } catch (e) {
                console.error("Token invalid");
            }
        }
    }
    
    // 3. Validasi Akhir
    if (userRole !== 'HRD') {
        return NextResponse.json({ error: 'Akses ditolak: Bukan HRD atau belum login.' }, { status: 403 });
    }

    try {
        // Hapus semua data
        const result = await prisma.leaveRequest.deleteMany({}); 
        return NextResponse.json({ 
            message: `Berhasil menghapus ${result.count} catatan cuti secara permanen.`,
            count: result.count
        }, { status: 200 });

    } catch (error) {
        console.error("DELETE Admin Leaves Error:", error);
        return NextResponse.json(
            { error: 'Gagal menghapus data cuti.' },
            { status: 500 }
        );
    }
}

// --- FUNGSI GET (Tabel Admin - Hybrid Auth) ---
export async function GET(request: Request) {
    let userRole: string | undefined;

    // 1. Cek Session Browser (Web)
    const session = await auth();
    if (session && session.user) {
        userRole = session.user.role;
    }

    // 2. Jika Session Kosong, Cek Token (Postman)
    if (!userRole) {
        const authorizationHeader = request.headers.get('authorization');
        const token = authorizationHeader?.split(' ')[1]; 
        
        if (token) {
            try {
                const decoded: any = jwt.verify(token, JWT_SECRET);
                userRole = decoded.role;
            } catch (e) {
                console.error("Token invalid");
            }
        }
    }
    
    // 3. Validasi Akhir
    if (userRole !== 'HRD') {
        return NextResponse.json({ error: 'Akses ditolak: Bukan HRD atau belum login.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const statusFilter = searchParams.get('status'); 
    const search = searchParams.get('search');
    const skip = (page - 1) * limit;

    try {
        const whereClause: any = {};
        
        // Filter Status
        if (statusFilter && statusFilter !== 'all') { 
            whereClause.status = statusFilter;
        }

        // Filter Search
        if (search) {
            whereClause.OR = [
                { employee: { fullName: { contains: search, mode: 'insensitive' } } },
                { department: { name: { contains: search, mode: 'insensitive' } } },
                { reason: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [leaveRequests, totalCount] = await prisma.$transaction([
            prisma.leaveRequest.findMany({
                where: whereClause,
                orderBy: {
                    createdAt: 'desc',
                },
                include: {
                    employee: { select: { fullName: true, email: true } },
                    department: { select: { name: true } },
                    hrdCommentBy: { select: { fullName: true } },
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
            page: page,
            limit: limit
        });
    } catch (error) {
        console.error("GET Admin Leaves Error:", error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}