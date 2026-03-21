'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function InviteRedirect() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  useEffect(() => {
    if (code) {
      router.replace(`/?invite=${code}`);
    }
  }, [code, router]);

  return null;
}
