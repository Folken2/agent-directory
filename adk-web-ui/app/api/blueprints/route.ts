import { NextResponse, type NextRequest } from 'next/server';
import { newRequestId } from '@/lib/api-error';
import { apiError } from '@/lib/api-response';
import { isDbEnabled } from '@/lib/db';
import { envInt } from '@/lib/env-int';
import { applyIdentityCookie } from '@/lib/identity';
import { resolveIdentity } from '@/lib/identity-server';
import { dbCounterStore } from '@/lib/limits/db-store';
import { releaseReservation, reserveBuckets } from '@/lib/limits/limiter';
import { rejectCrossOrigin } from '@/lib/origin-guard';
import { safeBookingUrl, saveSubmission, submissionBuckets, validateSubmission } from '@/lib/blueprint/submission';
import { notifyOwner } from '@/lib/blueprint/notify';
import { storeSubmission } from '@/lib/blueprint/db-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Save a builder blueprint with the visitor's email and explicit consent,
 * notify the site owner, and return the booking link. Logs carry reasons
 * and request ids only, never the email or blueprint.
 */
export async function POST(request: NextRequest) {
  const requestId = newRequestId();

  const crossOrigin = rejectCrossOrigin(request, requestId);
  if (crossOrigin) return crossOrigin;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('invalid_input', requestId, { log: 'invalid json' });
  }
  const parsed = validateSubmission(body);
  if (!parsed.ok) {
    const message =
      parsed.reason === 'consent'
        ? 'Please confirm you agree to be contacted.'
        : parsed.reason === 'email'
          ? 'Please enter a valid email address.'
          : undefined;
    return apiError('invalid_input', requestId, { message, log: `invalid ${parsed.reason}` });
  }

  if (!isDbEnabled()) return apiError('temporarily_unavailable', requestId, { log: 'no database' });

  const resolved = await resolveIdentity(request);
  const buckets = submissionBuckets(resolved.identity, {
    user: envInt('BLUEPRINT_SAVE_USER_DAILY', 10),
    anon: envInt('BLUEPRINT_SAVE_ANON_DAILY', 3),
    anonIp: envInt('BLUEPRINT_SAVE_ANON_IP_DAILY', 10),
  });
  const reservation = await reserveBuckets(buckets, { store: dbCounterStore });
  if (!reservation.ok) {
    const res =
      reservation.reason === 'limit'
        ? apiError('rate_limited', requestId, { message: "You've saved the maximum number of blueprints for today." })
        : apiError('temporarily_unavailable', requestId, { log: 'limiter unavailable' });
    applyIdentityCookie(res, resolved);
    return res;
  }

  try {
    const { id, notified } = await saveSubmission(parsed.value, resolved.identity, {
      store: storeSubmission,
      notify: notifyOwner,
    });
    if (!notified) console.warn(`[blueprints] owner notification failed requestId=${requestId}`);
    const res = NextResponse.json(
      { success: true, data: { id, bookingUrl: safeBookingUrl(process.env.BLUEPRINT_BOOKING_URL) } },
      { headers: { 'x-request-id': requestId } },
    );
    applyIdentityCookie(res, resolved);
    return res;
  } catch (error) {
    await releaseReservation(reservation.reservation, dbCounterStore);
    // The error object may echo the inserted values; log only its type.
    return apiError('internal', requestId, { log: error instanceof Error ? error.name : 'unknown' });
  }
}
