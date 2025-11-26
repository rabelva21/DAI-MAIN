// app/api/admin/leaves/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 


// >>> FUNGSI DELETE (Untuk Penghapusan Massal) <<<
export async function DELETE(request: Request) {
    
    // --- Otorisasi JWT MANUAL ---
    const authorizationHeader = request.headers.get('authorization');
    const token = authorizationHeader?.split(' ')[1]; 
    
    if (!token) {
        return NextResponse.json({ error: 'Token tidak tersedia.' }, { status: 401 });
    }

    let userRole: string;
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        userRole = decoded.role;
    } catch (e) {
        return NextResponse.json({ error: 'Token Akses tidak valid.' }, { status: 401 });
    }
    
    // Otorisasi: Hanya HRD (Admin) yang diizinkan
    if (userRole !== 'HRD') {
        return NextResponse.json({ error: 'Akses ditolak: Bukan HRD' }, { status: 403 });
    }
    // --- AKHIR OTORISASI ---

    try {
        // HAPUS SEMUA REKAMAN DI TABEL LeaveRequest
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


// --- FUNGSI GET (Pengambilan Data Admin dengan Pagination & Filter) ---
export async function GET(request: Request) {
    
    // --- OTORISASI JWT MANUAL ---
    const authorizationHeader = request.headers.get('authorization');
    const token = authorizationHeader?.split(' ')[1]; 
    
    if (!token) {
        return NextResponse.json({ error: 'Token tidak tersedia.' }, { status: 401 });
    }

    let userRole: string;
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        userRole = decoded.role;
    } catch (e) {
        return NextResponse.json({ error: 'Token Akses tidak valid.' }, { status: 401 });
    }
    
    // Otorisasi: Hanya HRD (Admin) yang diizinkan
    if (userRole !== 'HRD') {
        return NextResponse.json({ error: 'Akses ditolak: Bukan HRD' }, { status: 403 });
    }
    // --- AKHIR OTORISASI ---

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const statusFilter = searchParams.get('status'); 
    const search = searchParams.get('search');
    const skip = (page - 1) * limit;

    try {
        // Objek kondisi where untuk Prisma
        const whereClause: any = {};
        
        // Filter Status (Hanya filter jika nilainya ada dan bukan 'all')
        if (statusFilter && statusFilter !== 'all') { 
            whereClause.status = statusFilter;
        }

        // Filter Pencarian (Search)
        if (search) {
            whereClause.OR = [
                // Mencari berdasarkan nama karyawan
                { employee: { fullName: { contains: search, mode: 'insensitive' } } },
                // Mencari berdasarkan nama departemen
                { department: { name: { contains: search, mode: 'insensitive' } } },
                // Mencari berdasarkan alasan cuti
                { reason: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Ambil data dan total count dalam satu transaksi
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