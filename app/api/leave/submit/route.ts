// app/api/leave/submit/route.ts (PERBAIKAN FINAL)

import { NextResponse } from 'next/server';
import { PrismaClient, LeaveType } from '@prisma/client';
import jwt from 'jsonwebtoken'; 

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 


export async function POST(request: Request) {
    
    // --- OTORISASI JWT MANUAL ---
    const authorizationHeader = request.headers.get('authorization');
    const token = authorizationHeader?.split(' ')[1]; 
    
    if (!token) {
        return NextResponse.json({ error: 'Token tidak tersedia.' }, { status: 401 });
    }

    let userId: string;
    let departmentId: string; // Tipe data tetap string karena untuk Karyawan harus ada
    
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        
        if (decoded.role !== 'EMPLOYEE') {
            return NextResponse.json({ error: 'Akses ditolak: Hanya untuk Karyawan.' }, { status: 403 });
        }
        
        userId = decoded.userId; 
        
        // PASTIKAN departmentId TIDAK NULL. Jika null, tolak.
        if (!decoded.departmentId) {
             return NextResponse.json({ error: 'Akses ditolak: Data departemen karyawan tidak ditemukan.' }, { status: 403 });
        }
        departmentId = decoded.departmentId; // Ambil departmentId setelah dicek
    } catch (e) {
        return NextResponse.json({ error: 'Token Akses tidak valid.' }, { status: 401 });
    }
    // --- AKHIR PERBAIKAN OTORISASI ---

    const data = await request.json();
    
    const { startDate, endDate, leaveType, reason, daysTaken, proofUrl } = data;
    
    // --- VALIDASI INPUT DASAR (KINI LEBIH RINGKAS KARENA userId & departmentId SUDAH DICEK DI ATAS) ---
    if (
        !startDate ||
        !endDate ||
        !leaveType ||
        !reason ||
        !daysTaken ||
        !proofUrl // <-- proofUrl mungkin yang menyebabkan error jika tidak ada saat SICK/MATERNITY
    ) {
        // HANYA VALIDASI FIELD DARI BODY POSTMAN
        return NextResponse.json({ error: 'Input Body Postman tidak lengkap.' }, { status: 400 });
    }
    // --- AKHIR VALIDASI INPUT DASAR ---

    try {
        // Logika selanjutnya menggunakan userId dan departmentId yang sudah diverifikasi dari Token
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { department: true },
        });

        if (!user || !user.department) {
             // 404 karena data user di DB rusak atau tidak memiliki departemen
            return NextResponse.json(
                { error: 'Data Karyawan atau departemen di database tidak valid.' },
                { status: 404 }
            );
        }

        // --- Validasi 1: Jatah Cuti (ANNUAL) ---
        if (leaveType === 'ANNUAL' && user.remainingLeave < daysTaken) {
            return NextResponse.json(
                { error: 'Jatah cuti tidak mencukupi' },
                { status: 400 }
            );
        }
        
        // --- Validasi 2: Kuota Departemen ---
        const departmentQuota = user.department.maxConcurrentLeave;
        const overlappingRequests = await prisma.leaveRequest.count({
            where: {
                departmentId: departmentId,
                status: 'APPROVED',
                AND: [
                    { startDate: { lte: new Date(endDate) } },
                    { endDate: { gte: new Date(startDate) } },
                ],
            },
        });

        if (overlappingRequests >= departmentQuota) {
            return NextResponse.json(
                {
                    error: `Kuota departemen terlampaui. Sudah ada ${overlappingRequests} rekan yang cuti pada tanggal tersebut.`,
                },
                { status: 400 }
            );
        }

        // --- Validasi 3: Bukti Wajib ---
        // Pengecekan ini dipertahankan sebagai validasi redundant setelah pengecekan Input Body
        if (
            (leaveType === 'SICK' || leaveType === 'MATERNITY') &&
            !proofUrl
        ) {
            return NextResponse.json(
                { error: 'Bukti wajib diunggah untuk jenis cuti ini.' },
                { status: 400 }
            );
        }

        // --- Pengiriman: Simpan ke Database ---
        const newRequest = await prisma.leaveRequest.create({
            data: {
                employeeId: userId,
                departmentId: departmentId,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                leaveType: leaveType as LeaveType,
                reason,
                daysTaken: Number(daysTaken),
                status: 'PENDING',
                proofUrl: proofUrl, 
            },
        });

        return NextResponse.json(newRequest, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}