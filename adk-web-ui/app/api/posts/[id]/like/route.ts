import { NextRequest, NextResponse } from 'next/server';
import { isDbEnabled, getDb } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDbEnabled()) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    );
  }

  try {
    const { id } = await params;
    const postId = id;
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check if user already liked this post
    const existingLike = await db`
      SELECT id FROM post_likes WHERE post_id = ${postId} AND user_id = ${userId}
    `;

    if (existingLike.length > 0) {
      // Unlike
      await db`
        DELETE FROM post_likes WHERE post_id = ${postId} AND user_id = ${userId}
      `;
    } else {
      // Like
      await db`
        INSERT INTO post_likes (post_id, user_id) VALUES (${postId}, ${userId})
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    );
  }
}

