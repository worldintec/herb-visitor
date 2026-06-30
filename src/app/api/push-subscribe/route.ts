import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const { endpoint, keys } = await req.json();

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const supabase = getSupabase();

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' }
    );

  if (error) {
    console.error('push_subscriptions upsert error:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json();

  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  }

  const supabase = getSupabase();

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
