'use client';

import { useEffect, useState } from 'react';
import { getVapidPublicKey, subscribeToPush, unsubscribeFromPush } from '../../lib/push-api';
import { Button } from './button';

type Support = 'checking' | 'unsupported' | 'supported';

/** VAPID key vem em base64url — PushManager.subscribe() exige Uint8Array. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

/**
 * Estado real da inscrição sempre vem do PushManager do navegador, não de
 * uma flag salva localmente — assim, se o usuário revogar a permissão
 * pelas configurações do navegador, a tela reflete isso na próxima visita
 * em vez de continuar achando que está inscrito.
 */
export function NotificationsToggle() {
  const [support, setSupport] = useState<Support>('checking');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkSupport(): Promise<void> {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setSupport('unsupported');
        return;
      }
      setSupport('supported');

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(subscription !== null);
      } catch {
        // Sem service worker pronto ainda ou API indisponível — mantém o
        // default (não inscrito), a próxima visita tenta de novo.
      }
    }

    void checkSupport();
  }, []);

  async function handleEnable(): Promise<void> {
    setError(null);
    setIsWorking(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Permissão de notificação negada — ative pelas configurações do navegador pra tentar de novo.');
        return;
      }

      const { publicKey } = await getVapidPublicKey();
      if (!publicKey) {
        setError('Notificação push não está disponível no momento.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // BufferSource do DOM exige ArrayBuffer especificamente (não
        // ArrayBufferLike) — Uint8Array.from() de um array plano sempre
        // usa ArrayBuffer de verdade, é só uma lacuna no tipo do lib.dom.
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Inscrição de notificação incompleta.');
      }

      await subscribeToPush({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
      setIsSubscribed(true);
    } catch {
      setError('Não foi possível ativar as notificações. Tente de novo.');
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDisable(): Promise<void> {
    setError(null);
    setIsWorking(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch {
      setError('Não foi possível desativar as notificações. Tente de novo.');
    } finally {
      setIsWorking(false);
    }
  }

  if (support === 'unsupported') {
    return (
      <p className="text-sm text-text-secondary">Seu navegador não suporta notificações push.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-secondary">
        Receba um aviso na hora em que um trabalhador fizer check-in numa escala sua.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      {isSubscribed ? (
        <Button type="button" variant="outlined" onClick={handleDisable} isLoading={isWorking} className="self-start">
          Desativar notificações
        </Button>
      ) : (
        <Button type="button" onClick={handleEnable} isLoading={isWorking || support === 'checking'} className="self-start">
          Ativar notificações
        </Button>
      )}
    </div>
  );
}
