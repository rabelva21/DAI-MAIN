import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { LeaveStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export async function PATCH(request: Request) { return handleReview(request); }
export async function PUT(request: Request) { return handleReview(request); }

async function handleReview(request: Request) {
    let hrdUserId: string | undefined;
    let userRole: string | undefined;

    // 1. Auth Check
    const session = await auth();
    if (session?.user) {
        hrdUserId = session.user.id;
        userRole = session.user.role;
    } else {
        // Fallback Token (Postman)
        const token = request.headers.get('authorization')?.split(' ')[1];
        if (token) {
            try {
                const decoded: any = jwt.verify(token, JWT_SECRET);
                hrdUserId = decoded.userId;
                userRole = decoded.role;
            } catch {}
        }
    }

    if (userRole !== 'HRD' || !hrdUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { requestId, newStatus, hrdComment } = body;

        const leaveRequest = await prisma.leaveRequest.findUnique({
            where: { id: requestId },
            include: { department: true } // Include department
        });

        if (!leaveRequest) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

        // --- VALIDASI TAMBAHAN: CEK KUOTA DEPARTEMEN ---
        if (newStatus === 'APPROVED' && leaveRequest.departmentId && leaveRequest.status !== 'APPROVED') {
             const maxQuota = leaveRequest.department?.maxConcurrentLeave || 0;
             const overlappingRequests = await prisma.leaveRequest.count({
                 where: {
                     departmentId: leaveRequest.departmentId,
                     status: 'APPROVED',
                     id: { not: requestId },
                     AND: [
                         { startDate: { lte: leaveRequest.endDate } },
                         { endDate: { gte: leaveRequest.startDate } },
                     ],
                 },
             });
 
             if (overlappingRequests >= maxQuota) {
                 return NextResponse.json(
                     { error: `Kuota Departemen Penuh! Sudah ada ${overlappingRequests}/${maxQuota} orang approved.` }, 
                     { status: 400 }
                 );
             }
        }
        // -----------------------------------------------------

        // Transaksi
        await prisma.$transaction(async (tx) => {
            // A. Simpan ke Tabel Persetujuan_Cuti
            await tx.leaveApproval.upsert({
                where: { leaveRequestId: requestId },
                update: {
                    finalStatus: newStatus,
                    comment: hrdComment,
                    approvalDate: new Date(),
                    hrdId: hrdUserId as string // ID dari tabel HRD
                },
                create: {
                    leaveRequestId: requestId,
                    hrdId: hrdUserId as string, // ID dari tabel HRD
                    finalStatus: newStatus,
                    comment: hrdComment,
                    approvalDate: new Date(),
                }
            });

            // B. Update Status Utama
            await tx.leaveRequest.update({
                where: { id: requestId },
                data: { status: newStatus },
            });

            // C. Potong/Refund Kuota (Hanya untuk Karyawan)
            if (leaveRequest.leaveType === 'ANNUAL') {
                const isApproved = newStatus === 'APPROVED';
                const wasApproved = leaveRequest.status === 'APPROVED';

                if (isApproved && !wasApproved) {
                    await tx.karyawan.update({ // Perhatikan: tx.karyawan
                        where: { id: leaveRequest.employeeId },
                        data: { remainingLeave: { decrement: leaveRequest.daysTaken } },
                    });
                } else if (wasApproved && !isApproved) {
                    await tx.karyawan.update({
                        where: { id: leaveRequest.employeeId },
                        data: { remainingLeave: { increment: leaveRequest.daysTaken } },
                    });
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}