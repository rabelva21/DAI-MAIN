import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3';

export async function GET(request: Request) {
  let userId: string | undefined;

  // 1. Cek Session Browser
  const session = await auth();
  if (session && session.user) {
    userId = session.user.id;
  }

  // 2. Cek Header Token (Postman - Optional)
  if (!userId) {
    const authorizationHeader = request.headers.get('authorization');
    const token = authorizationHeader?.split(' ')[1];
    if (token) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
      } catch (e) {}
    }
  }

  if (!userId) {
    return NextResponse.json([], { status: 200 }); // Return array kosong jika tidak login
  }

  try {
    // Ambil semua request yang statusnya PENDING atau APPROVED
    const requests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: userId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
      select: {
        startDate: true,
        endDate: true,
        status: true
      },
    });

    return NextResponse.json(requests);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}