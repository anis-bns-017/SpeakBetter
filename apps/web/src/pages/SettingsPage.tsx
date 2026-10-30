import { useSettings } from '../hooks/useSettings';
import { SettingsForm } from '../components/settings/SettingsForm';
import { Sliders, AlertCircle, RefreshCw } from 'lucide-react';

export const SettingsPage = () => {
  const { settings, isLoading, error } = useSettings();

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  if (error || !settings) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center space-y-4 max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              Failed to Load Settings
            </h3>
            <p className="text-xs text-slate-500">
              {error?.toString() || "We couldn't fetch your account preferences. Please try again."}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Account Settings
            </h1>
            <p className="text-xs text-slate-500">
              Manage your profile preferences, notifications, and app experience.
            </p>
          </div>
        </div>

        {/* Main Settings Form Container */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
          <SettingsForm settings={settings} />
        </div>
      </div>
    </div>
  );
};

// Skeleton Loading Component
const SettingsSkeleton = () => (
  <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header Skeleton */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 animate-pulse">
        <div className="w-12 h-12 rounded-2xl bg-slate-200 shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-48 bg-slate-200 rounded-lg" />
          <div className="h-3 w-72 bg-slate-100 rounded-lg" />
        </div>
      </div>

      {/* Form Content Skeleton */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-5 w-32 bg-slate-200 rounded" />
          <div className="h-10 w-full bg-slate-50 rounded-xl" />
        </div>
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="h-5 w-40 bg-slate-200 rounded" />
          <div className="h-10 w-full bg-slate-50 rounded-xl" />
          <div className="h-10 w-full bg-slate-50 rounded-xl" />
        </div>
        <div className="pt-4 flex justify-end">
          <div className="h-10 w-28 bg-slate-200 rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);