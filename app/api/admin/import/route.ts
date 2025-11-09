import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { User, Department, LeaveRequest } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'HRD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
    }

    if (file.type !== 'application/json') {
      return NextResponse.json(
        { error: 'Format file tidak valid. Harap unggah file .json' },
        { status: 400 }
      );
    }

    const fileContent = await file.text();
    const data = JSON.parse(fileContent);

    // Validasi data backup (sederhana)
    if (!data.users || !data.departments || !data.leaveRequests) {
      return NextResponse.json(
        { error: 'File backup tidak valid atau rusak' },
        { status: 400 }
      );
    }

    const {
      users,
      departments,
      leaveRequests,
    }: {
      users: User[];
      departments: Department[];
      leaveRequests: LeaveRequest[];
    } = data;

    // Lakukan operasi dalam transaksi
    await prisma.$transaction(async (tx) => {
      // 1. Hapus data lama (mulai dari yang memiliki foreign key)
      await tx.leaveRequest.deleteMany();
      await tx.user.deleteMany();
      await tx.department.deleteMany();

      // 2. Impor data baru (pastikan ID string tetap sama)
      // Kita harus menggunakan createMany dengan data mentah
      // Catatan: Ini mengasumsikan ID adalah UUID/string yang valid
      
      // Penting: createMany di beberapa DB (seperti PostgreSQL)
      // mungkin tidak mengimpor relasi dengan sempurna.
      // Cara paling aman adalah create satu per satu, tapi createMany lebih cepat.
      
      // Kita harus menghapus relasi sebelum createMany
      const deptsData = departments.map(d => ({ id: d.id, name: d.name, maxConcurrentLeave: d.maxConcurrentLeave }));
      await tx.department.createMany({
        data: deptsData,
      });

      const usersData = users.map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        password: u.password, // Impor password yang sudah di-hash
        remainingLeave: u.remainingLeave,
        departmentId: u.departmentId,
        createdAt: new Date(u.createdAt), // Konversi string ISO kembali ke Date
      }));
      await tx.user.createMany({
        data: usersData,
      });

      const leaveRequestsData = leaveRequests.map(lr => ({
        id: lr.id,
        status: lr.status,
        leaveType: lr.leaveType,
        startDate: new Date(lr.startDate),
        endDate: new Date(lr.endDate),
        reason: lr.reason,
        daysTaken: lr.daysTaken,
        proofUrl: lr.proofUrl,
        hrdComment: lr.hrdComment,
        hrdCommentById: lr.hrdCommentById,
        employeeId: lr.employeeId,
        departmentId: lr.departmentId,
        createdAt: new Date(lr.createdAt),
        updatedAt: new Date(lr.updatedAt),
      }));
      await tx.leaveRequest.createMany({
        data: leaveRequestsData,
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Data berhasil diimpor.',
      counts: {
        departments: departments.length,
        users: users.length,
        leaveRequests: leaveRequests.length,
      },
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Gagal memproses file import', details: error.message },
      { status: 500 }
    );
  }
}