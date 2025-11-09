import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRole } from '@prisma/client';

// Skema validasi Zod
const registerSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  departmentId: z.string().uuid(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Validasi input
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Input tidak valid', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { email, fullName, password, departmentId } = validation.data;

    // 2. Cek apakah email sudah ada
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email ini sudah terdaftar' },
        { status: 409 } // 409 Conflict
      );
    }

    // 3. Cek apakah departemen ada
    const departmentExists = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!departmentExists) {
      return NextResponse.json(
        { error: 'Departemen tidak ditemukan' },
        { status: 400 }
      );
    }

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Buat user baru (HANYA SEBAGAI EMPLOYEE)
    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        departmentId,
        role: UserRole.EMPLOYEE, // <-- PENTING: Registrasi hanya untuk Karyawan
        remainingLeave: 12, // Jatah cuti awal
      },
    });

    // Jangan kembalikan password di response
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}