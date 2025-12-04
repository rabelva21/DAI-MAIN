import { RegisterForm } from '@/components/auth/register-form';
import Image from 'next/image';
import Link from 'next/link';
// import { Button } from '@/components/ui/button'; // Tidak digunakan di layout ini, bisa dihapus jika mau
// import { ArrowLeft } from 'lucide-react'; // Tidak digunakan di layout ini, bisa dihapus jika mau

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        
        {/* Header Logo */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <Image
            src="https://res.cloudinary.com/imagehandlers/image/upload/v1762437016/logo-daiprint_cfm1cn.webp"
            alt="PT. DAI Logo"
            width={80}
            height={80}
            // PERBAIKAN: Tambahkan 'w-20 h-auto' untuk menjaga aspect ratio dan menghilangkan warning
            className="shrink-0 w-20 h-auto"
            priority
          />
          <div>
            <h1 className="text-2xl font-bold text-black">
              Registrasi Karyawan
            </h1>
            <p className="text-sm text-gray-600">PT. Dharma Anugerah Indah</p>
          </div>
        </div>

        {/* Form Registrasi */}
        <RegisterForm />

        <p className="mt-6 text-center text-sm text-gray-600">
          Sudah punya akun?{' '}
          <Link
            href="/login/karyawan"
            className="font-medium text-red-600 hover:underline"
          >
            Login di sini
          </Link>
        </p>
      </div>
    </div>
  );
}