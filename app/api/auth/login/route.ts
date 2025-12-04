import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

        // 1. Cek di tabel Karyawan
        const karyawan = await prisma.karyawan.findUnique({ 
             where: { email }
        });

        let user: any = null;
        let role = '';
        let departmentId: string | null = null;

        if (karyawan) {
            user = karyawan;
            role = 'EMPLOYEE';
            departmentId = karyawan.departmentId;
        } else {
            // 2. Jika tidak ada, cek di tabel HRD
            const hrd = await prisma.hRD.findUnique({ 
                where: { email }
           });
           
           if (hrd) {
               user = hrd;
               role = 'HRD';
               departmentId = null; 
           }
        }

        if (!user) {
            return NextResponse.json(
                { error: 'Kredensial tidak valid.' }, 
                { status: 401 }
            );
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return NextResponse.json(
                { error: 'Kredensial tidak valid.' }, 
                { status: 401 }
            );
        }

        const token = jwt.sign(
            { 
                userId: user.id, 
                role: role, 
                departmentId: departmentId
            }, 
            JWT_SECRET, 
            { expiresIn: '1d' }
        );
        
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
            { error: 'Internal Server Error' }, 
            { status: 500 } 
        );
    }
}