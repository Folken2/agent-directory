import { NextRequest } from 'next/server';
import { db } from './drizzle/db';
import { anonymousSessions, agentRunEvents, authSessions } from './drizzle/schema';
import { eq, gte, and, sql, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';

// Check if database is available
const isDbAvailable = () => {
  try {
    return Boolean(process.env.DATABASE_URL);
  } catch {
    return false;
  }
};

const ANONYMOUS_SESSION_COOKIE_NAME = 'anonymous_session_token';

// Rate limits per user type
const RATE_LIMITS = {
  authenticated: 20,
  anonymous: 5,
} as const;

/**
 * Generate a cryptographically secure random session token
 */
function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Get IP address from request, handling proxy headers
 */
function getIpAddress(request: NextRequest): string | null {
  // Check for forwarded IP (common in production with proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  // Check for real IP header
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback to connection IP (may not be available in serverless)
  return null;
}

/**
 * Get or create an anonymous session for non-authenticated users
 * Returns the session token to use as rate limit identifier
 */
export async function getOrCreateAnonymousSession(
  request: NextRequest
): Promise<string> {
  // If database is not available, return a fallback token
  if (!isDbAvailable()) {
    return generateSessionToken();
  }

  try {
    // Check for existing session cookie
    const existingToken = request.cookies.get(ANONYMOUS_SESSION_COOKIE_NAME)?.value;
    
    if (existingToken) {
      try {
        // Verify session exists in database
        const session = await db
          .select()
          .from(anonymousSessions)
          .where(eq(anonymousSessions.sessionToken, existingToken))
          .limit(1);
        
        if (session.length > 0) {
          // Update last interaction time
          await db
            .update(anonymousSessions)
            .set({ lastInteractionAt: new Date() })
            .where(eq(anonymousSessions.sessionToken, existingToken));
          
          return existingToken;
        }
      } catch (dbError) {
        // Database error - log in development only
        if (process.env.NODE_ENV === 'development') {
          console.error('Database error checking anonymous session:', dbError);
        }
        // Continue to create new session
      }
    }
    
    // Create new anonymous session
    const newToken = generateSessionToken();
    const ipAddress = getIpAddress(request);
    const userAgent = request.headers.get('user-agent') || null;
    
    try {
      await db.insert(anonymousSessions).values({
        sessionToken: newToken,
        ipAddress: ipAddress || null,
        userAgent: userAgent,
        createdAt: new Date(),
        lastInteractionAt: new Date(),
      });
    } catch (dbError) {
      // If insert fails, still return the token
      if (process.env.NODE_ENV === 'development') {
        console.error('Database error creating anonymous session:', dbError);
      }
    }
    
    return newToken;
  } catch (error) {
    // If database operations fail, generate a token anyway
    // This ensures the request can proceed, though rate limiting won't work perfectly
    if (process.env.NODE_ENV === 'development') {
      console.error('Error managing anonymous session:', error);
    }
    return generateSessionToken();
  }
}

/**
 * Get the rate limit identifier for the current user
 * Returns user ID for authenticated users, session token for anonymous users
 */
export async function getRateLimitIdentifier(
  request: NextRequest
): Promise<{ identifier: string; userType: 'authenticated' | 'anonymous' }> {
  try {
    // Check if user is authenticated by looking for NextAuth session cookie
    // NextAuth v5 beta may use different cookie names - check all possibilities
    const possibleCookieNames = [
      'authjs.session-token',
      '__Secure-authjs.session-token',
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
    ];
    
    let sessionToken: string | undefined;
    for (const cookieName of possibleCookieNames) {
      const cookie = request.cookies.get(cookieName);
      if (cookie?.value) {
        sessionToken = cookie.value;
        break;
      }
    }
    
    if (sessionToken && isDbAvailable()) {
      try {
        // Look up the session in the database and check if it's still valid
        const now = new Date();
        const session = await db
          .select({
            userId: authSessions.userId,
          })
          .from(authSessions)
          .where(
            and(
              eq(authSessions.sessionToken, sessionToken),
              gte(authSessions.expires, now)
            )
          )
          .limit(1);
        
        if (session.length > 0 && session[0]?.userId) {
          return {
            identifier: session[0].userId,
            userType: 'authenticated',
          };
        }
      } catch (dbError) {
        // Database error - log but don't fail, treat as anonymous
        // Only log in development to avoid production noise
        if (process.env.NODE_ENV === 'development') {
          console.error('Database error checking session:', dbError);
        }
      }
    }
  } catch (error) {
    // If session check fails, treat as anonymous user
    // Don't log here to avoid spam - only log database-specific errors above
  }
  
  // User is not authenticated, get or create anonymous session
  try {
    const sessionToken = await getOrCreateAnonymousSession(request);
    return {
      identifier: sessionToken,
      userType: 'anonymous',
    };
  } catch (error) {
    // Even if anonymous session creation fails, return a fallback identifier
    console.error('Error creating anonymous session:', error);
    return {
      identifier: `fallback-${Date.now()}`,
      userType: 'anonymous',
    };
  }
}

/**
 * Get the number of interactions in the last 24 hours for a given identifier
 */
export async function getInteractionCount(identifier: string): Promise<number> {
  try {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    // Only count 'completed' or 'error' events to avoid double-counting
    // Each agent run creates both a 'running' and 'completed'/'error' event
    // We should only count the final state, not intermediate states
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentRunEvents)
      .where(
        and(
          eq(agentRunEvents.rateLimitIdentifier, identifier),
          gte(agentRunEvents.createdAt, twentyFourHoursAgo),
          inArray(agentRunEvents.status, ['completed', 'error'])
        )
      );
    
    return Number(result[0]?.count ?? 0);
  } catch (error) {
    console.error('Error getting interaction count:', error);
    // Return 0 on error to avoid blocking legitimate users
    return 0;
  }
}

/**
 * Check if the user has exceeded their rate limit
 * Returns object with allowed status, message, and current count/limit
 */
export async function checkRateLimit(
  identifier: string,
  userType: 'authenticated' | 'anonymous'
): Promise<{
  allowed: boolean;
  message?: string;
  count: number;
  limit: number;
}> {
  try {
    const limit = RATE_LIMITS[userType];
    const count = await getInteractionCount(identifier);
    
    if (count >= limit) {
      const userTypeLabel = userType === 'authenticated' ? 'Authenticated' : 'Non-authenticated';
      return {
        allowed: false,
        message: `${userTypeLabel} users are limited to ${limit} interactions per day. You have reached this limit. Please try again tomorrow or sign in for a higher limit.`,
        count,
        limit,
      };
    }
    
    return {
      allowed: true,
      count,
      limit,
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // Fail open - allow request if rate limit check fails
    // This prevents blocking legitimate users due to database issues
    return {
      allowed: true,
      count: 0,
      limit: RATE_LIMITS[userType],
    };
  }
}


