import { apiFetch } from '@shift/shared';

export function getVapidPublicKey(): Promise<{ publicKey: string | null }> {
  return apiFetch('/push/vapid-public-key');
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function subscribeToPush(subscription: PushSubscriptionPayload): Promise<{ id: string }> {
  return apiFetch('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription),
  });
}

export function unsubscribeFromPush(endpoint: string): Promise<void> {
  return apiFetch('/push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  });
}
