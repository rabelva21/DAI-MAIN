import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth'; // Import Auth Session
import jwt from 'jsonwebtoken'; 
import { LeaveStatus } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 

// --- FUNGSI 1: PATCH (Approve/Reject Cuti - Hybrid Auth) ---
export async function PATCH(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const requestId = params.id; 

    let hrdUserId: string | undefined;
    let userRole: string | undefined;

    // 1. Cek Session (Browser)
    const session = await auth();
    if (session && session.user) {
        hrdUserId = session.user.id;
        userRole = session.user.role;
    }

    // 2. Cek Token (Postman) - Fallback
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
    
    // 3. Validasi
    if (userRole !== 'HRD') {
        return NextResponse.json({ error: 'Akses ditolak: Bukan HRD atau belum login.' }, { status: 403 }); 
    }

    try {
        const body = await request.json();
        const { newStatus, hrdComment } = body;
        
        const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id: requestId } });

        if (!leaveRequest) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }
        
        const oldStatus = leaveRequest.status;
        const isAnnual = leaveRequest.leaveType === 'ANNUAL';
        const daysTaken = leaveRequest.daysTaken;

        await prisma.$transaction(async (tx) => {
            // Update status
            await tx.leaveRequest.update({
                where: { id: requestId },
                data: {
                    status: newStatus as LeaveStatus,
                    hrdComment: hrdComment,
                    hrdCommentById: hrdUserId, 
                    updatedAt: new Date(),
                },
            });

            // Logic Kurangi Jatah (Jika Disetujui)
            if (newStatus === 'APPROVED' && oldStatus !== 'APPROVED' && isAnnual) {
                await tx.user.update({
                    where: { id: leaveRequest.employeeId },
                    data: { remainingLeave: { decrement: daysTaken } },
                });
            }

            // Logic Kembalikan Jatah (Jika Batal Disetujui)
            if (oldStatus === 'APPROVED' && newStatus !== 'APPROVED' && isAnnual) {
                await tx.user.update({
                    where: { id: leaveRequest.employeeId },
                    data: { remainingLeave: { increment: daysTaken } },
                });
            }
        });

        return NextResponse.json({ success: true, message: `Status berhasil diubah menjadi ${newStatus}` }, { status: 200 });

    } catch (error: any) {
        console.error("PATCH Admin Leaves Error:", error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}


// --- FUNGSI 2: DELETE (Hapus Permanen - Hybrid Auth) ---
export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> } 
) {
    const params = await props.params;
    const requestIdToDelete = params.id;

    let userRole: string | undefined;

    // 1. Cek Session (Browser)
    const session = await auth();
    if (session && session.user) {
        userRole = session.user.role;
    }

    // 2. Cek Token (Postman) - Fallback
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
    
    // 3. Validasi
    if (userRole !== 'HRD') {
        return NextResponse.json({ error: 'Akses ditolak: Bukan HRD atau belum login.' }, { status: 403 }); 
    }

    try {
        await prisma.$transaction(async (tx) => {
            const leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: requestIdToDelete },
            });

            if (!leaveRequest) {
                throw new Error("Data cuti tidak ditemukan");
            }

            // Logika Refund: Jika yang dihapus statusnya APPROVED & tipe ANNUAL, kembalikan jatah cuti user
            if (leaveRequest.status === 'APPROVED' && leaveRequest.leaveType === 'ANNUAL') {
                await tx.user.update({
                    where: { id: leaveRequest.employeeId },
                    data: {
                        remainingLeave: {
                            increment: leaveRequest.daysTaken
                        }
                    }
                });
            }

            await tx.leaveRequest.delete({
                where: { id: requestIdToDelete },
            });
        });

        return NextResponse.json({ message: 'Catatan cuti berhasil dihapus permanen.' }, { status: 200 });

    } catch (error: any) {
        console.error("Delete Error:", error);

        if (error.message === "Data cuti tidak ditemukan") {
            return NextResponse.json({ error: 'Data tidak ditemukan.' }, { status: 404 });
        }

        return NextResponse.json({ error: 'Gagal menghapus catatan cuti.' }, { status: 500 });
    }
}