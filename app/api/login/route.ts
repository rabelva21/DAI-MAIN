// app/api/login/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Gunakan secret dari env
const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email dan password dibutuhkan.' }, 
                { status: 400 } 
            );
        }

        // 1. Cek di Tabel Karyawan
        let user: any = await prisma.karyawan.findUnique({ where: { email } });
        let role = 'EMPLOYEE';

        // 2. Jika tidak ada, Cek di Tabel HRD
        if (!user) {
            user = await prisma.hRD.findUnique({ where: { email } });
            role = 'HRD';
        }

        if (!user) {
            return NextResponse.json(
                { error: 'Kredensial tidak valid.' }, 
                { status: 401 }
            );
        }

        // 3. Bandingkan Password
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return NextResponse.json(
                { error: 'Kredensial tidak valid.' }, 
                { status: 401 }
            );
        }

        // 4. Generate Token (Hanya untuk keperluan API testing/mobile)
        const token = jwt.sign(
            { 
                userId: user.id, 
                role: role, 
                departmentId: user.departmentId || null 
            }, 
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Hapus password dari respons
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: userPassword, ...userData } = user;

        return NextResponse.json(
            { 
                user: { ...userData, role }, 
                message: "Login Berhasil",
                accessToken: token 
            }, 
            { status: 200 }
        );

    } catch (error) {
        console.error("Login API Error:", error);
        return NextResponse.json(
             { error: 'Terjadi kesalahan server.' }, 
             { status: 500 } 
        );
    }
}