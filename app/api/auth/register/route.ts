import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Skema Validasi Input (Zod)
const registerSchema = z.object({
    fullName: z.string().min(3, "Nama lengkap harus minimal 3 karakter."),
    email: z.string().email("Format email tidak valid."),
    departmentId: z.string().min(1, "ID Departemen tidak valid."),
    password: z.string().min(8, "Password harus minimal 8 karakter."),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 1. Validasi Input (Zod)
        const validation = registerSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: 'Input tidak valid', details: validation.error.format() },
                { status: 400 } // Bad Request
            );
        }

        const { email, fullName, password, departmentId } = validation.data;

        // 2. Cek Duplikasi Email (Di Karyawan & HRD)
        const existingKaryawan = await prisma.karyawan.findUnique({ where: { email } });
        const existingHRD = await prisma.hRD.findUnique({ where: { email } });

        if (existingKaryawan || existingHRD) {
            return NextResponse.json(
                { error: 'Email ini sudah terdaftar' },
                { status: 409 } // Conflict
            );
        }

        // 3. Cek Keberadaan Departemen
        const departmentExists = await prisma.department.findUnique({
            where: { id: departmentId },
        });

        if (!departmentExists) {
            return NextResponse.json(
                { error: 'Departemen tidak ditemukan' },
                { status: 400 }
            );
        }

        // 4. Hashing Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 5. Buat Karyawan Baru di Database (Table: Karyawan)
        const newKaryawan = await prisma.karyawan.create({
            data: {
                fullName,
                email,
                password: hashedPassword,
                departmentId,
                remainingLeave: 12, // Default sisa cuti
            },
        });

        // 6. Bersihkan Password dari Response
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userWithoutPassword } = newKaryawan;

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