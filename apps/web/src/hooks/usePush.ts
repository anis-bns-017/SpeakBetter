import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '../lib/api/client';
import { installState, promptInstall, subscribeInstallState, isIos, type InstallState } from '../lib/pwa';
import { PushError, currentSubscription, disablePush, enablePush, pushPermission, pushSupported, type PushPermission } from '../lib/push';
import { tr } from "../i18n/core";

export interface PushConfig {
  /** False when the server has no VAPID keys */
  enabled: boolean;
  publicKey: string | null;
}

export const usePushConfig = () =>
  useQuery({
    queryKey: ['push-config'],
    queryFn: async () => (await apiClient.get<PushConfig>('/push/config')).data,
    staleTime: 10 * 60_000,
  });

export const usePushStatus = () =>
  useQuery({
    queryKey: ['push-status'],
    queryFn: async () => (await apiClient.get<{ enabled: boolean; devices: number }>('/push/status')).data,
    staleTime: 30_000,
  });

const errorText = (e: unknown, fallback: string) =>
  e instanceof PushError ? e.message : (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** Everything the settings card and the dashboard banner need to know about push on this device */
export function usePushDevice() {
  const queryClient = useQueryClient();
  const config = usePushConfig();
  const [permission, setPermission] = useState<PushPermission>(pushPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setPermission(pushPermission());
    try {
      setSubscribed(!!(await currentSubscription()));
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    let live = true;
    currentSubscription()
      .then((sub) => live && setSubscribed(!!sub))
      .catch(() => live && setSubscribed(false));
    return () => {
      live = false;
    };
  }, []);

  const enable = async (): Promise<boolean> => {
    const key = config.data?.publicKey;
    if (!key) {
      toast.error(tr("Notifications are not set up on this server yet."));
      return false;
    }
    setBusy(true);
    try {
      await enablePush(key);
      toast.success(tr("Notifications are on for this device"));
      return true;
    } catch (e) {
      toast.error(errorText(e, "Couldn't turn notifications on."));
      return false;
    } finally {
      await refresh();
      queryClient.invalidateQueries({ queryKey: ['push-status'] });
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await disablePush();
      toast.success(tr("Notifications are off for this device"));
    } catch (e) {
      toast.error(errorText(e, "Couldn't turn notifications off."));
    } finally {
      await refresh();
      queryClient.invalidateQueries({ queryKey: ['push-status'] });
      setBusy(false);
    }
  };

  const test = useMutation({
    mutationFn: async () => (await apiClient.post<{ sent: number; enabled: boolean }>('/push/test')).data,
    onSuccess: ({ sent }) => {
      if (sent > 0) toast.success(tr("Sent. It should appear in a moment."));
      else toast.error(tr("Nothing was delivered. Check that push notifications are switched on in your settings."));
    },
    onError: (e) => toast.error(errorText(e, "Couldn't send a test.")),
  });

  return {
    supported: pushSupported(),
    permission,
    subscribed,
    busy,
    config: config.data ?? null,
    loadingConfig: config.isLoading,
    enable,
    disable,
    test,
  };
}

/** The browser's install offer, kept up to date as it arrives or the app gets installed */
export function useInstall() {
  const state = useSyncExternalStore<InstallState>(subscribeInstallState, installState);
  return { ...state, ios: isIos(), install: promptInstall };
}
