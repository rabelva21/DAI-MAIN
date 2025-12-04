import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { LeaveStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  
  // Cek jika user bukan HRD (role 'HRD' di tabel HRD)
  // Perhatikan: Karena kita pisah tabel, session.user.role diisi manual di auth.config.ts
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

    const [leaveRequests, totalCount] = await prisma.$transaction([
      prisma.leaveRequest.findMany({
        where: whereClause,
        include: {
          // Relasi ke Karyawan
          employee: {
            select: {
              fullName: true,
              email: true,
              remainingLeave: true,
            },
          },
          // Relasi ke Departemen
          department: {
            select: { name: true },
          },
          // Relasi ke Approval (Pengganti hrdCommentBy)
          approval: {
            include: {
              hrd: { // Ambil nama HRD dari tabel HRD
                select: { fullName: true }
              }
            }
          }
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

    // Format ulang data agar sesuai dengan frontend yang mengharapkan 'hrdCommentBy'
    const formattedData = leaveRequests.map(req => ({
        ...req,
        hrdComment: req.approval?.comment || null,
        hrdCommentBy: req.approval?.hrd ? { fullName: req.approval.hrd.fullName } : null
    }));

    return NextResponse.json({
      data: formattedData,
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