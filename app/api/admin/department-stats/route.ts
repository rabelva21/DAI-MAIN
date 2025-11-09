import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'HRD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Atur ke awal hari

    // 1. Dapatkan semua departemen
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        maxConcurrentLeave: true, // Ini adalah "Kuota Cuti Bersamaan"
      },
    });

    // 2. Dapatkan total hari cuti yang disetujui, dikelompokkan per departemen
    const totalDaysTakenByDept = await prisma.leaveRequest.groupBy({
      by: ['departmentId'],
      where: {
        status: 'APPROVED',
      },
      _sum: {
        daysTaken: true,
      },
    });

    // 3. Dapatkan jumlah karyawan yang sedang cuti HARI INI, per departemen
    const onLeaveTodayByDept = await prisma.leaveRequest.groupBy({
      by: ['departmentId'],
      where: {
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
      },
      _count: {
        _all: true,
      },
    });

    // 4. Gabungkan datanya
    const departmentStats = departments.map((dept) => {
      // Cari data total hari
      const totalDaysData = totalDaysTakenByDept.find(
        (d) => d.departmentId === dept.id
      );
      // Cari data cuti hari ini
      const onLeaveData = onLeaveTodayByDept.find(
        (d) => d.departmentId === dept.id
      );

      return {
        ...dept,
        totalDaysTaken: totalDaysData?._sum.daysTaken || 0,
        onLeaveToday: onLeaveData?._count._all || 0,
      };
    });

    return NextResponse.json(departmentStats);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}