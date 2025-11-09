import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'EMPLOYEE') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '5', 10);
  const skip = (page - 1) * limit;
  const userId = session.user.id;

  try {
    const whereClause = { employeeId: userId };

    const [leaveRequests, totalCount] = await prisma.$transaction([
      prisma.leaveRequest.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          hrdCommentBy: {
            select: { fullName: true },
          },
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