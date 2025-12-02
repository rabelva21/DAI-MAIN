import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth'; 
import { LeaveType } from '@prisma/client';
import jwt from 'jsonwebtoken'; 

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3';

export async function POST(request: Request) {
    let userId: string | undefined;
    let userRole: string | undefined;
    let departmentId: string | undefined;

    // --- 1. COBA AUTH SESSION (BROWSER) ---
    const session = await auth();
    if (session && session.user) {
        userId = session.user.id;
        userRole = session.user.role;
        departmentId = session.user.departmentId || undefined;
    } 
    
    // --- 2. JIKA KOSONG, COBA HEADER TOKEN (POSTMAN) ---
    if (!userId) {
        const authorizationHeader = request.headers.get('authorization');
        const token = authorizationHeader?.split(' ')[1];

        if (token) {
            try {
                const decoded: any = jwt.verify(token, JWT_SECRET);
                userId = decoded.userId;
                userRole = decoded.role;
                departmentId = decoded.departmentId;
            } catch (e) {
                console.error("Token invalid");
            }
        }
    }

    // --- 3. VALIDASI OTORISASI ---
    if (!userId || !userRole) {
        return NextResponse.json({ error: 'Unauthorized: Harap login.' }, { status: 401 });
    }

    if (userRole !== 'EMPLOYEE') {
        return NextResponse.json({ error: 'Akses ditolak: Hanya untuk Karyawan.' }, { status: 403 });
    }

    // Fallback ambil departmentId dari DB jika belum ada
    if (!departmentId) {
        const userCheck = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true }});
        departmentId = userCheck?.departmentId || undefined;
        
        if (!departmentId) {
            return NextResponse.json({ error: 'Data departemen tidak ditemukan pada akun Anda.' }, { status: 400 });
        }
    }

    try {
        const body = await request.json();
        const { startDate, endDate, leaveType, reason, daysTaken, proofUrl } = body;

        // Validasi Input Dasar
        if (!startDate || !endDate || !leaveType || !reason || !daysTaken) {
            return NextResponse.json({ error: 'Mohon lengkapi semua field wajib.' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { department: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
        }

        // >>> PERBAIKAN UTAMA: CEK BENTROKAN TANGGAL DIRI SENDIRI <<<
        // Kita cek apakah ada request dengan status PENDING atau APPROVED 
        // yang tanggalnya beririsan dengan request baru ini.
        const personalOverlap = await prisma.leaveRequest.findFirst({
            where: {
                employeeId: userId, // Cek milik user ini
                status: { in: ['PENDING', 'APPROVED'] }, // Abaikan yang REJECTED/CANCELLED
                AND: [
                    { startDate: { lte: new Date(endDate) } }, // Start Lama <= End Baru
                    { endDate: { gte: new Date(startDate) } }, // End Lama >= Start Baru
                ],
            },
        });

        if (personalOverlap) {
            return NextResponse.json(
                { error: 'Anda sudah memiliki pengajuan cuti (Menunggu/Disetujui) pada rentang tanggal tersebut.' },
                { status: 400 }
            );
        }
        // >>> AKHIR PERBAIKAN <<<


        // --- Validasi 1: Jatah Cuti (ANNUAL) ---
        if (leaveType === 'ANNUAL' && user.remainingLeave < daysTaken) {
            return NextResponse.json(
                { error: `Jatah cuti tidak mencukupi. Sisa: ${user.remainingLeave}, Diminta: ${daysTaken}` },
                { status: 400 }
            );
        }
        
        // --- Validasi 2: Kuota Departemen ---
        if (user.department) {
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
                        error: `Kuota cuti departemen penuh. Sudah ada ${overlappingRequests} orang cuti pada tanggal tersebut.`,
                    },
                    { status: 400 }
                );
            }
        }

        // --- Validasi 3: Bukti Wajib ---
        if ((leaveType === 'SICK' || leaveType === 'MATERNITY') && !proofUrl) {
            return NextResponse.json(
                { error: 'Bukti (Surat Dokter) wajib diunggah untuk jenis cuti ini.' },
                { status: 400 }
            );
        }

        // --- Simpan ke Database ---
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
                proofUrl: proofUrl || null, 
            },
        });

        return NextResponse.json({ message: "Pengajuan berhasil", data: newRequest }, { status: 201 });

    } catch (error) {
        console.error("Submit Leave Error:", error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan pada server.' },
            { status: 500 }
        );
    }
}