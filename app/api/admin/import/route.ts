import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { Karyawan, HRD, Department, LeaveRequest } from '@prisma/client';

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

    // Validasi data backup (Cek employees/users)
    // Support backward compatibility jika file lama pakai 'users'
    const importedEmployees = data.employees || data.users;
    
    if (!importedEmployees || !data.departments || !data.leaveRequests) {
      return NextResponse.json(
        { error: 'File backup tidak valid atau rusak' },
        { status: 400 }
      );
    }

    const {
      departments,
      leaveRequests,
    }: {
      departments: Department[];
      leaveRequests: LeaveRequest[];
    } = data;
    
    const employees: Karyawan[] = importedEmployees;
    const hrds: HRD[] = data.hrds || []; // Optional jika ada

    // Lakukan operasi dalam transaksi
    await prisma.$transaction(async (tx) => {
      // 1. Hapus data lama
      await tx.leaveApproval.deleteMany(); // Hapus approval dulu karena relasi
      await tx.leaveRequest.deleteMany();
      await tx.karyawan.deleteMany(); // PERBAIKAN: Hapus Karyawan
      // await tx.hRD.deleteMany(); // Opsional: Hapus HRD jika ingin replace full
      await tx.department.deleteMany();

      // 2. Impor data baru
      const deptsData = departments.map(d => ({ id: d.id, name: d.name, maxConcurrentLeave: d.maxConcurrentLeave }));
      await tx.department.createMany({
        data: deptsData,
      });

      const employeesData = employees.map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        password: u.password,
        remainingLeave: u.remainingLeave,
        departmentId: u.departmentId,
        createdAt: new Date(u.createdAt),
      }));
      
      // PERBAIKAN: Insert ke tabel Karyawan
      await tx.karyawan.createMany({
        data: employeesData,
      });

      // Insert HRD jika ada di file backup
      if (hrds.length > 0) {
          const hrdsData = hrds.map(h => ({
              id: h.id,
              email: h.email,
              fullName: h.fullName,
              password: h.password,
          }));
          // Cek duplikat email dengan HRD yg sedang login, skip jika perlu atau gunakan createMany dengan skipDuplicates (Prisma Client >5.x)
          // Untuk amannya, kita skip insert HRD agar admin yang login tidak terhapus/error, 
          // atau gunakan deleteMany di atas jika yakin.
          // await tx.hRD.createMany({ data: hrdsData, skipDuplicates: true });
      }

      const leaveRequestsData = leaveRequests.map(lr => ({
        id: lr.id,
        status: lr.status,
        leaveType: lr.leaveType,
        startDate: new Date(lr.startDate),
        endDate: new Date(lr.endDate),
        reason: lr.reason,
        daysTaken: lr.daysTaken,
        proofUrl: lr.proofUrl,
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
        users: employees.length,
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