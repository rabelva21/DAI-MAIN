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
    today.setHours(0, 0, 0, 0); // Set to start of today
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // Set to start of tomorrow

    // 1. Get total employees
    const totalEmployeesPromise = prisma.user.count({
      where: { role: 'EMPLOYEE' },
    });

    // 2. Get pending requests
    const pendingRequestsPromise = prisma.leaveRequest.count({
      where: { status: 'PENDING' },
    });

    // 3. Get employees currently on leave
    const employeesOnLeavePromise = prisma.leaveRequest.count({
      where: {
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });

    // 4. Get leave requests by department (all time)
    const requestsByDepartmentPromise = prisma.department.findMany({
      include: {
        _count: {
          select: { leaveRequests: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // 5. Get total requests (all time)
    const totalRequestsPromise = prisma.leaveRequest.count();

    // Run all queries in parallel
    const [
      totalEmployees,
      pendingRequests,
      employeesOnLeave,
      requestsByDepartmentData,
      totalRequests,
    ] = await Promise.all([
      totalEmployeesPromise,
      pendingRequestsPromise,
      employeesOnLeavePromise,
      requestsByDepartmentPromise,
      totalRequestsPromise,
    ]);

    // Format department data for chart
    const requestsByDepartment = requestsByDepartmentData.map((dept) => ({
      name: dept.name,
      total: dept._count.leaveRequests,
    }));

    return NextResponse.json({
      totalEmployees,
      totalRequests,
      pendingRequests,
      employeesOnLeave,
      requestsByDepartment,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}