import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          select: {
            fullName: true,
            email: true,
            remainingLeave: true,
          },
        },
        department: {
          select: { name: true },
        },
        hrdCommentBy: {
          select: { fullName: true },
        },
      },
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Validasi Akses: Hanya HRD atau Pemilik Data yang boleh lihat
    if (session.user.role !== 'HRD' && leaveRequest.employeeId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(leaveRequest, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}