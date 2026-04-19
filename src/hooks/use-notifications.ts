import { useState, useEffect, useCallback } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type NotificationState = "unsupported" | "denied" | "default" | "subscribed" | "loading";

export function useNotifications() {
  const [state, setState] = useState<NotificationState>("loading");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!supported) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) {
          setSubscription(sub);
          setState("subscribed");
        } else {
          setState(Notification.permission === "granted" ? "default" : "default");
        }
      });
    });
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported) return;
    setState("loading");

    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("denied");
        return;
      }

      const keyRes = await fetch("/api/notifications/vapid-key", { credentials: "include" });
      const { publicKey } = await keyRes.json();
      if (!publicKey) throw new Error("No VAPID public key returned");

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setSubscription(sub);
      setState("subscribed");
    } catch (err) {
      console.error("Push subscribe failed", err);
      setState("default");
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    setState("loading");
    try {
      await fetch("/api/notifications/unsubscribe", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
      setSubscription(null);
      setState("default");
    } catch (err) {
      console.error("Push unsubscribe failed", err);
      setState("subscribed");
    }
  }, [subscription]);

  return { state, subscribe, unsubscribe, supported };
}
