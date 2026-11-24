// apps/web/src/hooks/useEmailVerification.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authApi } from "../lib/api/auth";
import { tr } from "../i18n/core";

export const useVerificationStatus = (enabled: boolean) =>
  useQuery({
    queryKey: ["email-verification"],
    queryFn: async () => (await authApi.verificationStatus()).data,
    enabled,
    staleTime: 30_000,
    // The link usually opens in another tab: coming back here picks up that it worked
    refetchOnWindowFocus: true,
  });

export const useSendVerification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await authApi.sendVerification()).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["email-verification"] });
      if (result.verified) toast.success(tr("Your email is already confirmed."));
      else if (result.devLog) toast.info(tr("No email service is connected yet, so the link is in the server log."));
      else toast.success(tr("Link sent. Check your inbox and spam folder."));
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      toast.error(typeof message === "string" ? tr(message) : tr("We couldn't send the email. Try again in a minute."));
    },
  });
};
