import { NextResponse } from 'next/server';
import { PrismaClient, LeaveType } from '@prisma/client';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'EMPLOYEE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await request.json();
  // Ambil proofUrl dari body, bukan file
  const { startDate, endDate, leaveType, reason, daysTaken, proofUrl } = data;
  const userId = session.user.id;
  const departmentId = session.user.departmentId;

  // Validasi input dasar
  if (
    !startDate ||
    !endDate ||
    !leaveType ||
    !reason ||
    !daysTaken ||
    !userId ||
    !departmentId
  ) {
    return NextResponse.json({ error: 'Input tidak lengkap' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });

    if (!user || !user.department) {
      return NextResponse.json(
        { error: 'User atau departemen tidak ditemukan' },
        { status: 404 }
      );
    }

    // --- Validasi 1: Jatah Cuti (Fitur I.2) ---
    if (leaveType === 'ANNUAL' && user.remainingLeave < daysTaken) {
      return NextResponse.json(
        { error: 'Jatah cuti tidak mencukupi' },
        { status: 400 }
      );
    }

    // --- Validasi 2: Kuota Departemen (Fitur Unggulan I.2) ---
    const departmentQuota = user.department.maxConcurrentLeave;
    const overlappingRequests = await prisma.leaveRequest.count({
      where: {
        departmentId: departmentId,
        status: 'APPROVED',
        // Logika pengecekan tumpang tindih tanggal
        AND: [
          { startDate: { lte: new Date(endDate) } },
          { endDate: { gte: new Date(startDate) } },
        ],
      },
    });

    if (overlappingRequests >= departmentQuota) {
      return NextResponse.json(
        {
          error: `Kuota departemen terlampaui. Sudah ada ${overlappingRequests} rekan yang cuti pada tanggal tersebut.`,
        },
        { status: 400 }
      );
    }

    // --- Validasi 3: Bukti Wajib ---
    if (
      (leaveType === 'SICK' || leaveType === 'MATERNITY') &&
      !proofUrl
    ) {
      return NextResponse.json(
        { error: 'Bukti wajib diunggah untuk jenis cuti ini.' },
        { status: 400 }
      );
    }

    // --- Pengiriman: Simpan ke Database (Fitur I.2) ---
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
        proofUrl: proofUrl, // <-- SIMPAN URL DARI CLOUDINARY
      },
    });

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}