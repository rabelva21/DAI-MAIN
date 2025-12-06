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

    // 1. Validasi Role HRD
    if (!session?.user || session.user.role !== 'HRD') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { newStatus, hrdComment } = body;

        // 2. Ambil data request + info karyawan
        const leaveRequest = await prisma.leaveRequest.findUnique({
            where: { id: requestId },
            include: { 
                employee: true, // Ambil data karyawan untuk fallback departmentId
                department: true 
            }
        });

        if (!leaveRequest) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // ==================================================================================
        // 🔥 VALIDASI KUOTA DEPARTEMEN (ANTI JEBOL V2 - LEBIH KETAT) 🔥
        // ==================================================================================
        if (newStatus === 'APPROVED' && leaveRequest.status !== 'APPROVED') {
            
            // A. Cari Department ID yang valid (Cek di Request dulu, kalau null ambil dari Employee)
            const targetDeptId = leaveRequest.departmentId || leaveRequest.employee.departmentId;

            if (!targetDeptId) {
                return NextResponse.json({ error: 'Data Departemen tidak ditemukan pada Karyawan ini.' }, { status: 400 });
            }

            // B. Ambil Kuota Maksimal Departemen tersebut
            const deptData = await prisma.department.findUnique({
                where: { id: targetDeptId },
                select: { maxConcurrentLeave: true, name: true }
            });

            const maxQuota = deptData?.maxConcurrentLeave || 0;

            console.log(`[CHECK QUOTA] Dept: ${deptData?.name}, Max: ${maxQuota}`);

            // C. Hitung orang yang SUDAH Approved di tanggal yang bentrok
            const overlappingRequests = await prisma.leaveRequest.count({
                where: {
                    departmentId: targetDeptId, // Pakai ID yang sudah dipastikan ada
                    status: 'APPROVED',
                    id: { not: requestId }, // Jangan hitung diri sendiri
                    AND: [
                        { startDate: { lte: leaveRequest.endDate } },
                        { endDate: { gte: leaveRequest.startDate } },
                    ],
                },
            });

            console.log(`[CHECK QUOTA] Overlapping found: ${overlappingRequests}`);

            // D. Tolak jika penuh
            if (overlappingRequests >= maxQuota) {
                const errorMsg = `GAGAL: Kuota ${deptData?.name} Penuh! Sudah ada ${overlappingRequests} dari ${maxQuota} orang cuti di tanggal tersebut.`;
                console.error(errorMsg);
                return NextResponse.json({ error: errorMsg }, { status: 400 });
            }
        }
        // ==================================================================================

        const oldStatus = leaveRequest.status;
        const isAnnual = leaveRequest.leaveType === 'ANNUAL';
        const daysTaken = leaveRequest.daysTaken;

        // 3. Eksekusi Update
        await prisma.$transaction(async (tx) => {
            // A. Update Approval Table
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

            // B. Update Request Utama (Pastikan departmentId terisi jika sebelumnya null)
            await tx.leaveRequest.update({
                where: { id: requestId },
                data: {
                    status: newStatus as LeaveStatus,
                    updatedAt: new Date(),
                    // Update departmentId agar data konsisten ke depannya
                    departmentId: leaveRequest.departmentId || leaveRequest.employee.departmentId 
                },
            });

            // C. Update Sisa Cuti Karyawan
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
        console.error("Update Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE Method
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

            await tx.leaveApproval.deleteMany({ where: { leaveRequestId: requestId } });

            if (leaveRequest.status === 'APPROVED' && leaveRequest.leaveType === 'ANNUAL') {
                await tx.karyawan.update({
                    where: { id: leaveRequest.employeeId },
                    data: { remainingLeave: { increment: leaveRequest.daysTaken } }
                });
            }

            await tx.leaveRequest.delete({ where: { id: requestId } });
        });

        return NextResponse.json({ message: 'Deleted' }, { status: 200 });

    } catch (error: any) {
        if (error.message === "P2025" || error.code === 'P2025') {
            return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}