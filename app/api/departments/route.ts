import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

// GET: Mengambil semua departemen dan kuotanya
// FIX: Dibuat publik agar halaman registrasi bisa mengambil data
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(departments);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PUT: Mengupdate kuota departemen
// TETAP DIPROTEKSI: Hanya HRD yang bisa mengubah kuota
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'HRD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { departmentId, newQuota }: { departmentId: string; newQuota: number } =
      await request.json();

    if (!departmentId || newQuota === undefined || newQuota < 0) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const updatedDepartment = await prisma.department.update({
      where: { id: departmentId },
      data: { maxConcurrentLeave: Number(newQuota) },
    });

    return NextResponse.json(updatedDepartment);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}