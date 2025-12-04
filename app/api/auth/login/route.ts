import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken'; 

const JWT_SECRET = process.env.JWT_SECRET || 'a9bde15fa6d0d2d02e7786783b75352fa6e1cf4cc81813dddb91abf7c0dddeb3'; 

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

        // [2] Cari Pengguna (Cek Karyawan dulu, lalu HRD)
        let user: any = null;
        let role = '';
        let departmentId: string | null = null;

        // Cek di tabel Karyawan
        const karyawan = await prisma.karyawan.findUnique({ 
             where: { email }
        });

        if (karyawan) {
            user = karyawan;
            role = 'EMPLOYEE';
            departmentId = karyawan.departmentId;
        } else {
            // Jika tidak ada di Karyawan, cek di tabel HRD
            const hrd = await prisma.hRD.findUnique({ 
                where: { email }
           });
           
           if (hrd) {
               user = hrd;
               role = 'HRD';
               departmentId = null; // HRD tidak terikat departemen spesifik di skema ini
           }
        }

        // Jika user tidak ditemukan di kedua tabel
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

        // [4] BUAT TOKEN JWT
        const token = jwt.sign(
            { 
                userId: user.id, 
                role: role, 
                departmentId: departmentId
            }, 
            JWT_SECRET, 
            { expiresIn: '1d' }
        );
        
        // Hapus password dari respons
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: userPassword, ...userData } = user;

        // [5] Kembalikan Token dan Data User
        return NextResponse.json(
            { 
                user: { ...userData, role }, // Sertakan role di response user
                message: "Login Berhasil",
                accessToken: token 
            }, 
            { status: 200 }
        );

    } catch (error) {
        console.error("Login API Error:", error);
        return NextResponse.json(
            { error: 'Internal Server Error' }, 
            { status: 500 } 
        );
    }
}