// app/api/auth/login/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    // Pastikan request.json() berada di dalam try...catch
    try {
        const body = await request.json();
        const { email, password } = body;

        // Validasi cepat: Pastikan field utama ada
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email dan password dibutuhkan.' }, 
                { status: 400 } // Mengembalikan pesan 400 yang lebih jelas
            );
        }

        // 1. Cari Pengguna
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return NextResponse.json(
                { error: 'Kredensial tidak valid.' }, 
                { status: 401 }
            );
        }

        // 2. Bandingkan Password
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return NextResponse.json(
                { error: 'Kredensial tidak valid.' }, 
                { status: 401 }
            );
        }

        // 3. Login Berhasil - Kembalikan data atau token
        // (Anda harus implementasikan logika JWT/Session di sini,
        //  tapi untuk pengujian fungsionalitas, kita kembalikan data user)
        const { password: userPassword, ...userData } = user; // Hapus password dari respons

        return NextResponse.json(
            { user: userData, message: "Login Berhasil" }, 
            { status: 200 }
        );

    } catch (error) {
        // Blok ini menangkap error parsing atau error lain di server
        console.error("Login API Error:", error);
        
        // Mengembalikan 400 jika parsing body gagal (ini sering terjadi)
        return NextResponse.json(
             { error: 'Format permintaan JSON salah atau tidak lengkap.' }, 
             { status: 400 } 
        );
    }
}