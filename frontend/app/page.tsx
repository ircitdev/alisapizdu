'use client';

import { useState, useCallback } from 'react';
import Preloader from '@/components/Preloader';
import Chat from '@/components/Chat';

export default function Home() {
  const [loaded, setLoaded] = useState(false);

  const handleComplete = useCallback(() => {
    setLoaded(true);
  }, []);

  return (
    <main>
      {!loaded && <Preloader onComplete={handleComplete} />}
      <Chat />
    </main>
  );
}
