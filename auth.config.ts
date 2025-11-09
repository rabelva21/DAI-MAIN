import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { User } from 'next-auth'; // Import tipe User dari next-auth

// Skema validasi untuk login
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

          // Cari user di database
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user || !user.password) {
            return null;
          }

          // Verifikasi password
          const isPasswordValid = await bcrypt.compare(password, user.password);

          if (isPasswordValid) {
            // Login berhasil, kembalikan data user
            // Tipe 'user' dari Prisma sekarang akan cocok dengan tipe 'User' dari Next-Auth
            // karena kita sudah memperbaikinya di types/next-auth.d.ts
            return user;
          }

          return null;
        } catch (error) {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/login', // Arahkan ke halaman login kustom kita
  },
} satisfies NextAuthConfig;