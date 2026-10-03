'use client';

import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { User } from 'lucide-react';

export default function UserProfile() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {session.user.image ? (
        <Image
          src={session.user.image}
          alt={session.user.name || 'User'}
          width={32}
          height={32}
          className="rounded-full"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-md-primary-container flex items-center justify-center">
          <User className="w-4 h-4 text-md-on-primary-container" />
        </div>
      )}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-md-on-surface">
          {session.user.name || 'User'}
        </span>
        {session.user.email && (
          <span className="text-xs text-md-on-surface-variant">
            {session.user.email}
          </span>
        )}
      </div>
    </div>
  );
}
