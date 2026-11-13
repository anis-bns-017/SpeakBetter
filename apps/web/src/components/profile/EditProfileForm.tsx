import React, { useState } from "react";
import { toast } from "sonner";
import { tr } from "../../i18n/core";

// --- Local types (to avoid import errors) ---
interface Profile {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
  };
  nativeLanguage?: string | null;
  learningLanguages?: string[];
  country?: string | null;
  bio?: string | null;
  interests?: string[];
  goals?: string[];
  xp?: number;
  streak?: number;
}

interface UpdateProfileData {
  country?: string;
  nativeLanguage?: string;
  learningLanguages?: string[];
  interests?: string[];
  goals?: string[];
  bio?: string;
}

interface EditProfileFormProps {
  profile: Profile;
  onCancel: () => void;
  onSuccess: () => void;
}

// --- Mock hook (replace with your actual hook) ---
const useProfile = () => ({
  updateProfile: async (data: UpdateProfileData) => {
    // Simulate API call
    console.log("Updating profile:", data);
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
  isUpdating: false,
});

export const EditProfileForm: React.FC<EditProfileFormProps> = ({
  profile,
  onCancel,
  onSuccess,
}) => {
  const { updateProfile, isUpdating } = useProfile();
  const [formData, setFormData] = useState<UpdateProfileData>({
    country: profile.country || "",
    nativeLanguage: profile.nativeLanguage || "",
    learningLanguages: profile.learningLanguages || [],
    interests: profile.interests || [],
    goals: profile.goals || [],
    bio: profile.bio || "",
  });

  const [learningInput, setLearningInput] = useState("");
  const [interestsInput, setInterestsInput] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile(formData);
      toast.success(tr("Profile updated successfully! ✅"));
      onSuccess();
    } catch {
      toast.error(tr("Failed to update profile"));
    }
  };

  const addLearning = () => {
    if (
      learningInput.trim() &&
      !formData.learningLanguages?.includes(learningInput.trim())
    ) {
      setFormData({
        ...formData,
        learningLanguages: [
          ...(formData.learningLanguages || []),
          learningInput.trim(),
        ],
      });
      setLearningInput("");
    }
  };

  const removeLearning = (lang: string) => {
    setFormData({
      ...formData,
      learningLanguages: formData.learningLanguages?.filter((l) => l !== lang),
    });
  };

  const addInterest = () => {
    if (
      interestsInput.trim() &&
      !formData.interests?.includes(interestsInput.trim())
    ) {
      setFormData({
        ...formData,
        interests: [...(formData.interests || []), interestsInput.trim()],
      });
      setInterestsInput("");
    }
  };

  const removeInterest = (interest: string) => {
    setFormData({
      ...formData,
      interests: formData.interests?.filter((i) => i !== interest),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow p-6 max-w-2xl mx-auto"
    >
      <h3 className="text-xl font-bold mb-4">{tr("Edit Profile")}</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {tr("Country")}</label>
          <input
            type="text"
            value={formData.country}
            onChange={(e) =>
              setFormData({ ...formData, country: e.target.value })
            }
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {tr("Native Language")}</label>
          <input
            type="text"
            value={formData.nativeLanguage}
            onChange={(e) =>
              setFormData({ ...formData, nativeLanguage: e.target.value })
            }
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {tr("Learning Languages")}</label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={learningInput}
              onChange={(e) => setLearningInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              placeholder={tr("Add language")}
            />
            <button
              type="button"
              onClick={addLearning}
              className="px-4 py-2 bg-blue-500 text-white rounded-md"
            >
              {tr("Add")}</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.learningLanguages?.map((lang) => (
              <span
                key={lang}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
              >
                {lang}
                <button
                  type="button"
                  onClick={() => removeLearning(lang)}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {tr("Interests")}</label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={interestsInput}
              onChange={(e) => setInterestsInput(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              placeholder={tr("Add interest")}
            />
            <button
              type="button"
              onClick={addInterest}
              className="px-4 py-2 bg-blue-500 text-white rounded-md"
            >
              {tr("Add")}</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.interests?.map((interest) => (
              <span
                key={interest}
                className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-2"
              >
                {interest}
                <button
                  type="button"
                  onClick={() => removeInterest(interest)}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{tr("Bio")}</label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            rows={4}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder={tr("Tell about yourself...")}
          />
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={isUpdating}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isUpdating ? tr("Saving...") : tr("Save Changes")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            {tr("Cancel")}</button>
        </div>
      </div>
    </form>
  );
};
