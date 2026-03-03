import { NextRequest, NextResponse } from 'next/server';
import { isDbEnabled, getDb } from '@/lib/db';

export async function GET() {
  if (!isDbEnabled()) {
    return NextResponse.json({ posts: [] });
  }

  try {
    const db = await getDb();
    // Get all posts first
    const postsResult = await db`
      SELECT id, title, content, author, author_id, created_at
      FROM posts
      ORDER BY created_at DESC
      LIMIT 50
    `;

    // Get likes and comments for each post
    const posts = await Promise.all(
      postsResult.map(async (post: any) => {
        const likesResult = await db`
          SELECT user_id FROM post_likes WHERE post_id = ${post.id}
        `;
        const commentsResult = await db`
          SELECT id FROM post_comments WHERE post_id = ${post.id}
        `;

        return {
          id: post.id,
          title: post.title,
          content: post.content,
          author: post.author,
          authorId: post.author_id,
          createdAt: post.created_at instanceof Date ? post.created_at.toISOString() : String(post.created_at),
          likes: likesResult.length,
          comments: commentsResult.length,
          likedBy: likesResult.map((l: any) => l.user_id),
        };
      })
    );

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ posts: [] });
  }
}

export async function POST(request: NextRequest) {
  if (!isDbEnabled()) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 500 }
    );
  }

  try {
    const { title, content, authorId, author } = await request.json();

    if (!title || !content || !authorId || !author) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const result = await db`
      INSERT INTO posts (title, content, author_id, author)
      VALUES (${title}, ${content}, ${authorId}, ${author})
      RETURNING id, title, content, author, author_id, created_at
    `;

    const post = result[0];
    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        title: post.title,
        content: post.content,
        author: post.author,
        authorId: post.author_id,
        createdAt: post.created_at instanceof Date ? post.created_at.toISOString() : String(post.created_at),
        likes: 0,
        comments: 0,
        likedBy: [],
      },
    });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}

