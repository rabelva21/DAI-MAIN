import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth'; // Gunakan Auth Session
import { LeaveStatus } from '@prisma/client';
import jwt from 'jsonwebtoken'; 

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 

export async function PATCH(request: Request) { // Ubah method jadi PATCH agar sesuai standar (atau PUT jika frontend pakai PUT)
    return handleReview(request);
}

export async function PUT(request: Request) {
    return handleReview(request);
}

async function handleReview(request: Request) {
    let hrdUserId: string | undefined;
    let userRole: string | undefined;

    // --- 1. CEK SESSION BROWSER (WEB) ---
    const session = await auth();
    if (session && session.user) {
        hrdUserId = session.user.id;
        userRole = session.user.role;
    }

    // --- 2. JIKA KOSONG, CEK HEADER TOKEN (POSTMAN) ---
    if (!userRole) {
        const authorizationHeader = request.headers.get('authorization');
        const token = authorizationHeader?.split(' ')[1];
        
        if (token) {
            try {
                const decoded: any = jwt.verify(token, JWT_SECRET);
                hrdUserId = decoded.userId; 
                userRole = decoded.role; 
            } catch (e) {
                console.error("Token invalid");
            }
        }
    }
    
    // --- 3. VALIDASI FINAL ---
    if (!hrdUserId || !userRole) {
        return NextResponse.json({ error: 'Unauthorized: Harap login.' }, { status: 401 });
    }

    if (userRole !== 'HRD') {
        return NextResponse.json({ error: 'Unauthorized: Hanya HRD yang boleh melakukan ini.' }, { status: 401 }); // Status 403 atau 401
    }

    try {
        const body = await request.json();
        const {
            requestId,
            newStatus,
            hrdComment,
        }: {
            requestId: string;
            newStatus: LeaveStatus;
            hrdComment: string;
        } = body;

        const leaveRequest = await prisma.leaveRequest.findUnique({
            where: { id: requestId },
        });

        if (!leaveRequest) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        const oldStatus = leaveRequest.status;
        const isAnnual = leaveRequest.leaveType === 'ANNUAL';
        const daysTaken = leaveRequest.daysTaken;

        // --- Logika Database (Transaksi) ---
        await prisma.$transaction(async (tx) => {
            // 1. Update status
            await tx.leaveRequest.update({
                where: { id: requestId },
                data: {
                    status: newStatus,
                    hrdComment: hrdComment,
                    hrdCommentById: hrdUserId, 
                    updatedAt: new Date(),
                },
            });

            // 2. Kurangi Jatah (Jika Disetujui & Cuti Tahunan)
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

            // 3. Kembalikan Jatah (Jika Batal Disetujui)
            if (
                oldStatus === 'APPROVED' &&
                newStatus !== 'APPROVED' &&
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
        console.error("Review API Error:", error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}