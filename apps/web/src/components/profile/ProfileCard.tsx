import React from 'react';

// ========== TYPES ==========
interface Profile {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
  };
  // Basic info
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  country?: string | null;
  city?: string | null;
  timezone?: string | null;
  dateOfBirth?: string | null;
  // Languages
  nativeLanguage?: string | null;
  learningLanguages?: string[];
  // Interests & Goals
  interests?: string[];
  goals?: string[];
  // Stats
  xp?: number;
  streak?: number;
  level?: string | null;
  followersCount?: number;
  followingCount?: number;
  isVerified?: boolean;
  // Timestamps
  lastActive?: string;
  createdAt?: string;
}

interface ProfileCardProps {
  profile: Profile;
  onEdit: () => void;
  onShare?: () => void;
  onMessage?: () => void;
  onFollow?: () => void;
  isOwnProfile?: boolean;
}

// ========== COMPONENT ==========
export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  onEdit,
  onShare,
  onMessage,
  onFollow,
  isOwnProfile = true,
}) => {
  // Helper to format date
  const formatDate = (date?: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Helper to get level badge color
  const getLevelColor = (level?: string) => {
    const colors: Record<string, string> = {
      beginner: 'bg-green-100 text-green-700',
      elementary: 'bg-blue-100 text-blue-700',
      intermediate: 'bg-yellow-100 text-yellow-700',
      'upper-intermediate': 'bg-orange-100 text-orange-700',
      advanced: 'bg-red-100 text-red-700',
      native: 'bg-purple-100 text-purple-700',
    };
    return colors[level?.toLowerCase() || ''] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-4xl mx-auto">
      {/* ===== COVER IMAGE ===== */}
      <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 relative">
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 flex justify-between items-end">
          {/* Avatar */}
          <div className="flex items-end gap-4">
            <div className="w-24 h-24 rounded-full border-4 border-white bg-gray-300 flex items-center justify-center text-3xl font-bold text-gray-600 shadow-lg overflow-hidden">
              {profile.user.avatarUrl ? (
                <img
                  src={profile.user.avatarUrl}
                  alt={profile.user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                profile.user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="text-white pb-1">
              <h1 className="text-2xl font-bold">
                {profile.displayName || profile.user.name}
              </h1>
              <p className="text-sm text-white/80">@{profile.username || profile.user.email.split('@')[0]}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pb-1">
            {isOwnProfile ? (
              <button
                onClick={onEdit}
                className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition"
              >
                ✏️ Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={onFollow}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  Follow
                </button>
                <button
                  onClick={onMessage}
                  className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition"
                >
                  💬 Message
                </button>
              </>
            )}
            {onShare && (
              <button
                onClick={onShare}
                className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition"
              >
                Share
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div className="px-6 py-4">
        {/* Verified Badge & Basic Info */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-gray-600">{profile.user.email}</span>
          {profile.isVerified && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full flex items-center gap-1">
              ✅ Verified
            </span>
          )}
          {profile.level && (
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getLevelColor(profile.level)}`}>
              {profile.level}
            </span>
          )}
          {profile.lastActive && (
            <span className="text-xs text-gray-400">
              Last active: {formatDate(profile.lastActive)}
            </span>
          )}
        </div>

        {/* ===== BIO ===== */}
        {profile.bio && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-gray-700">{profile.bio}</p>
          </div>
        )}

        {/* ===== STATS GRID ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl text-center">
            <p className="text-2xl font-bold text-blue-600">{profile.xp || 0}</p>
            <p className="text-xs text-gray-500">XP</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl text-center">
            <p className="text-2xl font-bold text-orange-600">{profile.streak || 0}🔥</p>
            <p className="text-xs text-gray-500">Streak</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl text-center">
            <p className="text-2xl font-bold text-green-600">{profile.followersCount || 0}</p>
            <p className="text-xs text-gray-500">Followers</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl text-center">
            <p className="text-2xl font-bold text-purple-600">{profile.followingCount || 0}</p>
            <p className="text-xs text-gray-500">Following</p>
          </div>
        </div>

        {/* ===== LANGUAGES ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-sm font-semibold text-gray-500">Native Language</p>
            <p className="text-lg font-medium">{profile.nativeLanguage || 'Not set'}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-sm font-semibold text-gray-500">Learning Languages</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {profile.learningLanguages?.length ? (
                profile.learningLanguages.map((lang) => (
                  <span key={lang} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {lang}
                  </span>
                ))
              ) : (
                <p className="text-gray-400">Not set</p>
              )}
            </div>
          </div>
        </div>

        {/* ===== LOCATION & PERSONAL ===== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {profile.country && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Country</p>
              <p className="font-medium">{profile.country}</p>
            </div>
          )}
          {profile.city && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">City</p>
              <p className="font-medium">{profile.city}</p>
            </div>
          )}
          {profile.dateOfBirth && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Date of Birth</p>
              <p className="font-medium">{formatDate(profile.dateOfBirth)}</p>
            </div>
          )}
          {profile.timezone && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500">Timezone</p>
              <p className="font-medium">{profile.timezone}</p>
            </div>
          )}
        </div>

        {/* ===== INTERESTS ===== */}
        {profile.interests && profile.interests.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-500 mb-2">Interests</p>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((interest, i) => (
                <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ===== GOALS ===== */}
        {profile.goals && profile.goals.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-500 mb-2">🎯 Goals</p>
            <div className="flex flex-wrap gap-2">
              {profile.goals.map((goal, i) => (
                <span key={i} className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                  {goal}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ===== TIMESTAMPS ===== */}
        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400 flex justify-between">
          <span>Member since: {formatDate(profile.createdAt)}</span>
        </div>
      </div>
    </div>
  );
};