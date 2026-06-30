'use client';

import { useState } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushSubscribeButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'subscribed' | 'denied' | 'error'>('idle');

  const subscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('error');
      return;
    }

    setStatus('loading');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setStatus('denied');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      const json = sub.toJSON();
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });

      setStatus('subscribed');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'subscribed') {
    return <p className="text-sm text-green-700">通知を受け取る設定が完了しました ✓</p>;
  }

  if (status === 'denied') {
    return <p className="text-sm text-red-600">通知が許可されていません。ブラウザの設定から変更してください。</p>;
  }

  return (
    <button
      onClick={subscribe}
      disabled={status === 'loading'}
      className="text-sm px-4 py-2 rounded-lg bg-green-600 text-white disabled:opacity-50"
    >
      {status === 'loading' ? '処理中...' : 'プッシュ通知を受け取る'}
    </button>
  );
}
