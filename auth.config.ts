import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authConfig = {
  providers: [
    Credentials({
      async authorize(credentials) {
        try {
          const { email, password } = await loginSchema.parseAsync(credentials);

          // 1. Cek Login sebagai KARYAWAN
          const karyawan = await prisma.karyawan.findUnique({ where: { email } });
          if (karyawan) {
            const match = await bcrypt.compare(password, karyawan.password);
            if (match) {
              return {
                id: karyawan.id,
                email: karyawan.email,
                name: karyawan.fullName,
                fullName: karyawan.fullName, // Field tambahan untuk session
                role: 'EMPLOYEE',            // Hardcode role
                remainingLeave: karyawan.remainingLeave,
                departmentId: karyawan.departmentId,
              };
            }
          }

          // 2. Cek Login sebagai HRD
          // Pastikan model di prisma/schema.prisma bernama "HRD" (huruf besar/kecil harus sama)
          const hrd = await prisma.hRD.findUnique({ where: { email } });
          if (hrd) {
            const match = await bcrypt.compare(password, hrd.password);
            if (match) {
              return {
                id: hrd.id,
                email: hrd.email,
                name: hrd.fullName,
                fullName: hrd.fullName,
                role: 'HRD',                 // Hardcode role
                remainingLeave: 0,
                departmentId: null,
              };
            }
          }

          return null;
        } catch (error) {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
} satisfies NextAuthConfig;