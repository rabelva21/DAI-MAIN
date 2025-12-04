import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { LeaveStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function PATCH(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const requestId = params.id;
    const session = await auth();

    if (!session?.user || session.user.role !== 'HRD') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { newStatus, hrdComment } = body;

        const leaveRequest = await prisma.leaveRequest.findUnique({
            where: { id: requestId }
        });

        if (!leaveRequest) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        const oldStatus = leaveRequest.status;
        const isAnnual = leaveRequest.leaveType === 'ANNUAL';
        const daysTaken = leaveRequest.daysTaken;

        await prisma.$transaction(async (tx) => {
            // 1. Update/Create Approval di tabel LeaveApproval
            await tx.leaveApproval.upsert({
                where: { leaveRequestId: requestId },
                create: {
                    leaveRequestId: requestId,
                    hrdId: session.user.id,
                    finalStatus: newStatus as LeaveStatus,
                    comment: hrdComment,
                    approvalDate: new Date(),
                },
                update: {
                    hrdId: session.user.id,
                    finalStatus: newStatus as LeaveStatus,
                    comment: hrdComment,
                    approvalDate: new Date(),
                }
            });

            // 2. Update status di tabel LeaveRequest
            await tx.leaveRequest.update({
                where: { id: requestId },
                data: {
                    status: newStatus as LeaveStatus,
                    updatedAt: new Date(),
                },
            });

            // 3. Logic Kuota Cuti (Gunakan tx.karyawan)
            if (isAnnual) {
                if (newStatus === 'APPROVED' && oldStatus !== 'APPROVED') {
                    await tx.karyawan.update({
                        where: { id: leaveRequest.employeeId },
                        data: { remainingLeave: { decrement: daysTaken } },
                    });
                }
                else if (oldStatus === 'APPROVED' && newStatus !== 'APPROVED') {
                    await tx.karyawan.update({
                        where: { id: leaveRequest.employeeId },
                        data: { remainingLeave: { increment: daysTaken } },
                    });
                }
            }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const requestId = params.id;
    const session = await auth();

    if (!session?.user || session.user.role !== 'HRD') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await prisma.$transaction(async (tx) => {
            const leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: requestId },
            });

            if (!leaveRequest) throw new Error("P2025");

            // Hapus Approval dulu
            await tx.leaveApproval.deleteMany({
                where: { leaveRequestId: requestId }
            });

            // Refund Kuota (Gunakan tx.karyawan)
            if (leaveRequest.status === 'APPROVED' && leaveRequest.leaveType === 'ANNUAL') {
                const userExists = await tx.karyawan.findUnique({
                    where: { id: leaveRequest.employeeId }
                });

                if (userExists) {
                    await tx.karyawan.update({
                        where: { id: leaveRequest.employeeId },
                        data: { remainingLeave: { increment: leaveRequest.daysTaken } }
                    });
                }
            }

            // Hapus Request
            await tx.leaveRequest.delete({
                where: { id: requestId },
            });
        });

        return NextResponse.json({ message: 'Deleted' }, { status: 200 });

    } catch (error: any) {
        if (error.message === "P2025" || error.code === 'P2025') {
            return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}