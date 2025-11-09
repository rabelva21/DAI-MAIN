import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { LeaveStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'HRD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status') as LeaveStatus | 'all';
  const searchQuery = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  const skip = (page - 1) * limit;

  try {
    const whereClause: any = {
      OR: [
        { employee: { fullName: { contains: searchQuery, mode: 'insensitive' } } },
        { department: { name: { contains: searchQuery, mode: 'insensitive' } } },
      ],
    };

    if (statusFilter && statusFilter !== 'all') {
      whereClause.status = statusFilter;
    }

    // Gunakan $transaction untuk mengambil data dan total count dalam satu query
    const [leaveRequests, totalCount] = await prisma.$transaction([
      prisma.leaveRequest.findMany({
        where: whereClause,
        include: {
          employee: {
            select: {
              fullName: true,
              email: true,
              remainingLeave: true, // <-- Penting untuk dialog detail
            },
          },
          department: {
            select: { name: true },
          },
          hrdCommentBy: {
            select: { fullName: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: skip,
        take: limit,
      }),
      prisma.leaveRequest.count({
        where: whereClause,
      }),
    ]);

    return NextResponse.json({
      data: leaveRequests,
      totalCount: totalCount,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}