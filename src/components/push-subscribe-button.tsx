'use client';

import { useEffect, useState } from 'react';
import { isStandalone, detectMobilePlatform } from '@/lib/platform';
import { urlBase64ToUint8Array } from '@/lib/push-subscription';
import AddToHomeScreenModal from '@/components/add-to-home-screen-modal';

type Status = 'checking' | 'idle' | 'loading' | 'subscribed' | 'denied' | 'error' | 'unsupported-ios';

export default function PushSubscribeButton() {
  const [status, setStatus] = useState<Status>('checking');
  const [showAddToHomeScreenModal, setShowAddToHomeScreenModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) {
          // iOSはホーム画面に追加したPWA（standalone）でしかWeb Pushに対応していないため、
          // Safariで直接開いた場合はここに来る。汎用エラーではなく追加手順を案内する。
          // 手順のモーダルはボタンを押したときだけ開く（開いただけで出すと、ホームを
          // 開くたびに出てしまう）。自動の案内は add-to-home-screen-prompt が1回だけ出す。
          if (detectMobilePlatform() === 'ios' && !isStandalone()) {
            setStatus('unsupported-ios');
          } else {
            setStatus('error');
          }
        }
        return;
      }

      if (Notification.permission === 'denied') {
        if (!cancelled) setStatus('denied');
        return;
      }

      // permissionが'granted'でなければ購読は存在しえないはずだが、
      // 端末によっては古い/迷子のPushSubscriptionがgetSubscription()で
      // 返ってくることがあるため、未許可時に「完了」と誤表示しないよう
      // permissionの実際の値を確認してから購読状態を見る
      if (Notification.permission !== 'granted') {
        if (!cancelled) setStatus('idle');
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus(sub ? 'subscribed' : 'idle');
      } catch (err) {
        console.error('プッシュ購読状態の確認に失敗しました:', err);
        if (!cancelled) setStatus('idle');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      if (detectMobilePlatform() === 'ios' && !isStandalone()) {
        setStatus('unsupported-ios');
        setShowAddToHomeScreenModal(true);
      } else {
        setStatus('error');
      }
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
    } catch (err) {
      console.error('プッシュ通知の購読に失敗しました:', err);
      setStatus('error');
    }
  };

  if (status === 'checking') {
    return null;
  }

  if (status === 'subscribed') {
    return <p className="text-sm text-green-700">通知を受け取る設定が完了しました ✓</p>;
  }

  if (status === 'denied') {
    return <p className="text-sm text-red-600">通知が許可されていません。ブラウザの設定から変更してください。</p>;
  }

  if (status === 'unsupported-ios') {
    return (
      <>
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-herb-text-secondary text-center max-w-xs">
            iPhoneで通知を受け取るには、まずホーム画面に追加してから開いてください。
          </p>
          <button
            onClick={() => setShowAddToHomeScreenModal(true)}
            className="text-sm px-4 py-2 rounded-lg bg-green-600 text-white"
          >
            ホーム画面への追加のしかた
          </button>
        </div>
        {showAddToHomeScreenModal && (
          <AddToHomeScreenModal
            platform="ios"
            title="ホーム画面に追加してください"
            description="iPhoneでプッシュ通知を受け取るには、ホーム画面に追加してアイコンから開き直し、再度ログインすると通知を許可できるようになります。"
            onClose={() => setShowAddToHomeScreenModal(false)}
          />
        )}
      </>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm text-red-600">通知の設定に失敗しました。</p>
        <button onClick={subscribe} className="text-sm px-4 py-2 rounded-lg bg-green-600 text-white">
          もう一度試す
        </button>
      </div>
    );
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
