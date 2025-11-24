import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();

  // 1. Cek Otorisasi Admin
  if (!session?.user || session.user.role !== 'HRD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Ambil Query Params (Search, Filter, Pagination)
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const searchQuery = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const skip = (page - 1) * limit;

  try {
    // 3. Buat Filter Pencarian
    const whereClause: Prisma.LeaveRequestWhereInput = {
      OR: [
        { employee: { fullName: { contains: searchQuery, mode: 'insensitive' } } },
        { department: { name: { contains: searchQuery, mode: 'insensitive' } } },
      ],
    };

    if (statusFilter && statusFilter !== 'all') {
      whereClause.status = statusFilter as any;
    }

    // 4. Ambil Data & Total Hitungan (Transaction)
    const [leaveRequests, totalCount] = await prisma.$transaction([
      prisma.leaveRequest.findMany({
        where: whereClause,
        include: {
          employee: {
            select: { fullName: true, email: true, remainingLeave: true },
          },
          department: { select: { name: true } },
          hrdCommentBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: skip,
        take: limit,
      }),
      prisma.leaveRequest.count({ where: whereClause }),
    ]);

    // 5. Kirim Data ke Frontend
    return NextResponse.json({
      data: leaveRequests,
      totalCount: totalCount,
    });

  } catch (error) {
    console.error("Error fetching leaves:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}