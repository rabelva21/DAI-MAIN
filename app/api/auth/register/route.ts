// app/api/auth/register/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRole } from '@prisma/client';

// Skema Validasi Input (Zod)
const registerSchema = z.object({
    fullName: z.string().min(3, "Nama lengkap harus minimal 3 karakter."),
    email: z.string().email("Format email tidak valid."),
    departmentId: z.string().uuid("ID Departemen tidak valid."),
    password: z.string().min(8, "Password harus minimal 8 karakter."),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 1. Validasi Input (Zod)
        const validation = registerSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                // Mengembalikan detail error Zod untuk feedback frontend yang lebih baik
                { error: 'Input tidak valid', details: validation.error.format() },
                { status: 400 } // Bad Request
            );
        }

        const { email, fullName, password, departmentId } = validation.data;

        // 2. Cek Duplikasi Email
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'Email ini sudah terdaftar' },
                { status: 409 } // Conflict (Sesuai skenario pengujian)
            );
        }

        // 3. Cek Keberadaan Departemen (Memastikan Foreign Key valid)
        const departmentExists = await prisma.department.findUnique({
            where: { id: departmentId },
        });

        if (!departmentExists) {
            return NextResponse.json(
                { error: 'Departemen tidak ditemukan' },
                { status: 400 } // Bad Request
            );
        }

        // 4. Hashing Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 5. Buat User Baru di Database
        const newUser = await prisma.user.create({
            data: {
                fullName,
                email,
                password: hashedPassword,
                departmentId,
                role: UserRole.EMPLOYEE, // Role Karyawan
                remainingLeave: 12, // Default sisa cuti awal (sesuai seed data)
            },
        });

        // 6. Bersihkan Password dari Response dan Kembalikan Sukses (201 Created)
        const { password: _, ...userWithoutPassword } = newUser;

        return NextResponse.json(
            { 
                message: "Registrasi berhasil",
                user: userWithoutPassword 
            }, 
            { status: 201 }
        );
        
    } catch (error) {
        console.error("Registrasi API Error:", error);
        
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}