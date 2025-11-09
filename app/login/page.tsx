import { Building2, User, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';


export default function LoginHubPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-4">
          {/* Logo Anda */}
          <div>
            <Image
              src="https://res.cloudinary.com/imagehandlers/image/upload/v1762437016/logo-daiprint_cfm1cn.webp" // Ganti dengan path logo Anda
              alt="PT. DAI Logo"
              width={80}
              height={80}
              className="shrink-0" // Mencegah logo mengecil
 // Tambahkan ini agar logo dimuat lebih cepat
            />
          </div>
          {/* Teks di samping logo */}
          <div>
            <h1 className="text-2xl font-bold text-black">
              PT. Dharma Anugerah Indah
            </h1>
            <p className="text-sm text-center text-gray-600">Form Pengajuan Cuti</p>
          </div>
        </div>

        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-center text-2xl text-black">
              Login Sebagai
            </CardTitle>
            <CardDescription className="text-center">
              Pilih peran Anda untuk melanjutkan
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Button
              asChild
              variant="outline"
              className="h-20 flex-col gap-2 border-gray-300"
            >
              <Link href="/login/karyawan">
                <User className="h-6 w-6" />
                <span className="font-semibold">Karyawan</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-20 flex-col gap-2 border-gray-300"
            >
              <Link href="/login/admin">
                <ShieldAlert className="h-6 w-6" />
                <span className="font-semibold">Admin / HRD</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}