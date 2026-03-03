import { NextRequest, NextResponse } from 'next/server';
import { isDbEnabled, getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDbEnabled()) {
    return NextResponse.json({ comments: [] });
  }

  try {
    const { id: postId } = await params;
    const db = await getDb();

    const comments = await db`
      SELECT id, post_id, user_id, author, content, created_at
      FROM post_comments
      WHERE post_id = ${postId}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({
      comments: comments.map((c: any) => ({
        id: c.id,
        postId: c.post_id,
        userId: c.user_id,
        author: c.author,
        content: c.content,
        createdAt: c.created_at instanceof Date ? c.created_at.toISOString() : String(c.created_at),
      })),
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ comments: [] });
  }
}

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
    const { id: postId } = await params;
    const { content, userId, author } = await request.json();

    if (!content || !userId || !author) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const result = await db`
      INSERT INTO post_comments (post_id, user_id, author, content)
      VALUES (${postId}, ${userId}, ${author}, ${content})
      RETURNING id, post_id, user_id, author, content, created_at
    `;

    const comment = result[0];
    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        postId: comment.post_id,
        userId: comment.user_id,
        author: comment.author,
        content: comment.content,
        createdAt: comment.created_at instanceof Date ? comment.created_at.toISOString() : String(comment.created_at),
      },
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
