// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'; 

// Pastikan kunci ini ada di .env Anda
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-ganti-ini'; 


export async function POST(request: Request) {
    try {
        // [1] Validasi Input
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email dan password dibutuhkan.' }, 
                { status: 400 }
            );
        }

        // [2] Cari Pengguna
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return NextResponse.json(
                { error: 'Kredensial tidak valid.' }, 
                { status: 401 }
            );
        }

        // [3] Verifikasi Password
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return NextResponse.json(
                { error: 'Kredensial tidak valid.' }, 
                { status: 401 }
            );
        }

        // [4] BUAT TOKEN JWT (Login Sukses)
        const token = jwt.sign(
            { userId: user.id, role: user.role }, // Payload token
            JWT_SECRET, // Secret key Anda
            { expiresIn: '1d' } // Masa berlaku token 1 hari
        );
        
        // Hapus password dari respons sebelum dikirim
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: userPassword, ...userData } = user;

        // [5] Kembalikan Token dan Data User
        return NextResponse.json(
            { 
                user: userData, 
                message: "Login Berhasil",
                accessToken: token // TOKEN YANG AKAN ANDA SALIN DI POSTMAN
            }, 
            { status: 200 }
        );

    } catch (error) {
        console.error("Login API Error:", error);
        return NextResponse.json(
             { error: 'Format permintaan JSON salah atau terjadi error internal.' }, 
             { status: 400 } 
        );
    }
}