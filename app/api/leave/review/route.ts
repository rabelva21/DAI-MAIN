import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { LeaveStatus } from '@prisma/client';
import jwt from 'jsonwebtoken'; 

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 

export async function PATCH(request: Request) {
    return handleReview(request);
}

export async function PUT(request: Request) {
    return handleReview(request);
}

async function handleReview(request: Request) {
    let hrdUserId: string | undefined;
    let userRole: string | undefined;

    // 1. Cek Session
    const session = await auth();
    if (session && session.user) {
        hrdUserId = session.user.id;
        userRole = session.user.role;
    }

    // 2. Cek Token
    if (!userRole) {
        const authorizationHeader = request.headers.get('authorization');
        const token = authorizationHeader?.split(' ')[1];
        if (token) {
            try {
                const decoded: any = jwt.verify(token, JWT_SECRET);
                hrdUserId = decoded.userId; 
                userRole = decoded.role; 
            } catch (e) { console.error("Token invalid"); }
        }
    }
    
    // 3. Validasi
    if (userRole !== 'HRD') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { requestId, newStatus, hrdComment } = body;

        const leaveRequest = await prisma.leaveRequest.findUnique({
            where: { id: requestId },
        });

        if (!leaveRequest) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

        const daysTaken = leaveRequest.daysTaken;
        const isAnnual = leaveRequest.leaveType === 'ANNUAL';
        const oldStatus = leaveRequest.status;

        // TRANSAKSI DATABASE
        await prisma.$transaction(async (tx) => {
            
            // A. Simpan ke Tabel Persetujuan_Cuti (LeaveApproval)
            // Ini akan masuk ke tabel "Persetujuan_Cuti" di database
            await tx.leaveApproval.upsert({
                where: { leaveRequestId: requestId },
                update: {
                    finalStatus: newStatus,
                    comment: hrdComment,
                    approvalDate: new Date(),
                    hrdId: hrdUserId as string
                },
                create: {
                    leaveRequestId: requestId,
                    hrdId: hrdUserId as string,
                    finalStatus: newStatus,
                    comment: hrdComment,
                    approvalDate: new Date(),
                }
            });

            // B. Update Status di Tabel Permintaan_Cuti
            await tx.leaveRequest.update({
                where: { id: requestId },
                data: { status: newStatus },
            });

            // C. Logika Saldo Cuti
            if (newStatus === 'APPROVED' && oldStatus !== 'APPROVED' && isAnnual) {
                await tx.user.update({
                    where: { id: leaveRequest.employeeId },
                    data: { remainingLeave: { decrement: daysTaken } },
                });
            }
            if (oldStatus === 'APPROVED' && newStatus !== 'APPROVED' && isAnnual) {
                await tx.user.update({
                    where: { id: leaveRequest.employeeId },
                    data: { remainingLeave: { increment: daysTaken } },
                });
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Review Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}