import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth'; // Import Auth Session
import jwt from 'jsonwebtoken'; 

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 

export async function GET(request: Request) {
  let userRole: string | undefined;

  // --- 1. CEK SESSION BROWSER (WEB) ---
  const session = await auth();
  if (session && session.user) {
      userRole = session.user.role;
  }

  // --- 2. JIKA KOSONG, CEK HEADER TOKEN (POSTMAN) ---
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
  
  // --- 3. VALIDASI FINAL ---
  if (userRole !== 'HRD') {
      // Return array kosong atau error JSON, tapi dengan status 401
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Tentukan Rentang Waktu "HARI INI" (00:00:00 - 23:59:59)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. Dapatkan semua departemen
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        maxConcurrentLeave: true,
      },
      orderBy: { name: 'asc' },
    });

    // 2. Dapatkan total hari cuti yang disetujui (All Time)
    const totalDaysTakenByDept = await prisma.leaveRequest.groupBy({
      by: ['departmentId'],
      where: {
        status: 'APPROVED',
      },
      _sum: {
        daysTaken: true,
      },
    });

    // 3. Dapatkan jumlah karyawan yang sedang cuti HARI INI
    const onLeaveTodayByDept = await prisma.leaveRequest.groupBy({
      by: ['departmentId'],
      where: {
        status: 'APPROVED',
        AND: [
          { startDate: { lte: todayEnd } },   
          { endDate: { gte: todayStart } }    
        ]
      },
      _count: {
        _all: true,
      },
    });

    // 4. Gabungkan datanya
    const departmentStats = departments.map((dept) => {
      const totalDaysData = totalDaysTakenByDept.find(
        (d) => d.departmentId === dept.id
      );
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