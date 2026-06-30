import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
  'mailto:info-saitama@farm-group.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const { title, body, url } = await req.json();

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
  }

  const payload = JSON.stringify({ title, body: body ?? '', url: url ?? '/' });
  const staleEndpoints: string[] = [];

  await Promise.allSettled(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  if (staleEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', staleEndpoints);
  }

  return NextResponse.json({
    sent: (subscriptions?.length ?? 0) - staleEndpoints.length,
    removed: staleEndpoints.length,
  });
}
