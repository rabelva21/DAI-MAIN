import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { LeaveStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// --- FUNGSI 1: PATCH (Approve/Reject Cuti) ---
export async function PATCH(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const requestId = params.id; 
    const session = await auth();

    // Validasi Role
    if (!session?.user || session.user.role !== 'HRD') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { newStatus, hrdComment } = body;
        
        // Ambil data lama untuk perbandingan status
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
            
            // A. Simpan/Update data persetujuan di tabel LeaveApproval (Persetujuan_Cuti)
            // Ini perbaikan utamanya: hrdComment tidak lagi di LeaveRequest
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

            // B. Update status di tabel Utama (LeaveRequest)
            await tx.leaveRequest.update({
                where: { id: requestId },
                data: {
                    status: newStatus as LeaveStatus,
                    updatedAt: new Date(),
                },
            });

            // C. Logic Kuota Cuti (Update ke tabel Karyawan)
            if (isAnnual) {
                // Jika Disetujui (sebelumnya belum): Kurangi
                if (newStatus === 'APPROVED' && oldStatus !== 'APPROVED') {
                    await tx.karyawan.update({
                        where: { id: leaveRequest.employeeId },
                        data: { remainingLeave: { decrement: daysTaken } },
                    });
                } 
                // Jika Batal Disetujui (sebelumnya approved): Refund
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

// --- FUNGSI 2: DELETE (Hapus Permanen) ---
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
            // A. Cari dulu datanya untuk memastikan record ada
            const leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: requestId },
            });

            if (!leaveRequest) {
                throw new Error("P2025"); 
            }

            // B. Hapus Data Approval Terkait Dulu (PENTING AGAR TIDAK ERROR FOREIGN KEY)
            await tx.leaveApproval.deleteMany({
                where: { leaveRequestId: requestId }
            });

            // C. Logika Refund Jatah Cuti sebelum hapus (GANTI tx.user JADI tx.karyawan)
            if (leaveRequest.status === 'APPROVED' && leaveRequest.leaveType === 'ANNUAL') {
                const userExists = await tx.karyawan.findUnique({
                    where: { id: leaveRequest.employeeId }
                });

                if (userExists) {
                    await tx.karyawan.update({
                        where: { id: leaveRequest.employeeId },
                        data: {
                            remainingLeave: {
                                increment: leaveRequest.daysTaken
                            }
                        }
                    });
                }
            }

            // D. Hapus Data Cuti Utama
            await tx.leaveRequest.delete({
                where: { id: requestId },
            });
        });

        return NextResponse.json({ message: 'Deleted' }, { status: 200 });

    } catch (error: any) {
        console.error("Delete Error:", error);

        if (error.message === "P2025" || error.code === 'P2025') {
            return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}