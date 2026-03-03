'use client';

import { useEffect } from 'react';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Add class to body to identify chat page
    document.body.classList.add('chat-page');
    
    return () => {
      // Remove class when leaving chat page
      document.body.classList.remove('chat-page');
    };
  }, []);

  return <>{children}</>;
}
