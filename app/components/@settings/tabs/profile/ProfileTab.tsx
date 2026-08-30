import { useState, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { profileStore, updateProfile } from '~/lib/stores/profile';
import { authUserStore } from '~/lib/stores/auth';
import { toast } from 'react-toastify';
import { debounce } from '~/utils/debounce';

export default function ProfileTab() {
  const profile = useStore(profileStore);
  const authUser = useStore(authUserStore);
  const [isUploading, setIsUploading] = useState(false);

  // Create debounced update functions
  const debouncedUpdate = useCallback(
    debounce((field: 'username', value: string) => {
      updateProfile({ [field]: value });
      toast.success('사용자 이름이 업데이트됐어요');
    }, 1000),
    [],
  );

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setIsUploading(true);

      // Convert the file to base64
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64String = reader.result as string;
        updateProfile({ avatar: base64String });
        setIsUploading(false);
        toast.success('프로필 사진이 업데이트됐어요');
      };

      reader.onerror = () => {
        console.error('Error reading file:', reader.error);
        setIsUploading(false);
        toast.error('프로필 사진을 업데이트하지 못했어요');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setIsUploading(false);
      toast.error('프로필 사진을 업데이트하지 못했어요');
    }
  };

  const handleProfileUpdate = (field: 'username', value: string) => {
    // Update the store immediately for UI responsiveness
    updateProfile({ [field]: value });

    // Debounce the toast notification
    debouncedUpdate(field, value);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-6">
        {/* Personal Information Section */}
        <div>
          {/* Avatar Upload */}
          <div className="flex items-start gap-6 mb-8">
            <div
              className={classNames(
                'w-24 h-24 rounded-full overflow-hidden',
                'bg-bolt-elements-background-depth-3',
                'flex items-center justify-center',
                'ring-1 ring-bolt-elements-borderColor',
                'relative group',
                'transition-all duration-300 ease-out',
                'hover:ring-[#FF5330]/30 dark:hover:ring-[#FF5330]/30',
                'hover:shadow-lg hover:shadow-[#FF5330]/10',
              )}
            >
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt="프로필"
                  className={classNames(
                    'w-full h-full object-cover',
                    'transition-all duration-300 ease-out',
                    'group-hover:scale-105 group-hover:brightness-90',
                  )}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-3xl font-semibold text-white"
                  style={{ background: '#FF5330' }}
                >
                  {(profile.username || authUser?.email || '?').trim().charAt(0).toUpperCase()}
                </div>
              )}

              <label
                className={classNames(
                  'absolute inset-0',
                  'flex items-center justify-center',
                  'bg-black/0 group-hover:bg-black/40',
                  'cursor-pointer transition-all duration-300 ease-out',
                  isUploading ? 'cursor-wait' : '',
                )}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                />
                {isUploading ? (
                  <div className="i-ph:spinner-gap w-6 h-6 text-white animate-spin" />
                ) : (
                  <div className="i-ph:camera-plus w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out transform group-hover:scale-110" />
                )}
              </label>
            </div>

            <div className="flex-1 pt-1">
              <label className="block text-base font-medium text-bolt-elements-textPrimary mb-1">프로필 사진</label>
              <p className="text-sm text-bolt-elements-textSecondary">프로필 사진이나 아바타를 업로드하세요</p>
            </div>
          </div>

          {/* Username Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">사용자 이름</label>
            <div className="relative group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <div className="i-ph:user-circle-fill w-5 h-5 text-bolt-elements-textTertiary transition-colors group-focus-within:text-[#FF5330]" />
              </div>
              <input
                type="text"
                value={profile.username}
                onChange={(e) => handleProfileUpdate('username', e.target.value)}
                className={classNames(
                  'w-full pl-11 pr-4 py-2.5 rounded-xl',
                  'bg-bolt-elements-background-depth-4',
                  'border border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary',
                  'placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-2 focus:ring-[#FF5330]/50 focus:border-[#FF5330]/50',
                  'transition-all duration-300 ease-out',
                )}
                placeholder="사용자 이름을 입력하세요"
              />
            </div>
          </div>

          {/* Email (읽기 전용) */}
          {authUser?.email && (
            <div className="mb-8">
              <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">이메일</label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                  <div className="i-ph:envelope-simple w-5 h-5 text-bolt-elements-textTertiary" />
                </div>
                <input
                  type="text"
                  value={authUser.email}
                  readOnly
                  disabled
                  className={classNames(
                    'w-full pl-11 pr-4 py-2.5 rounded-xl',
                    'bg-bolt-elements-background-depth-4',
                    'border border-bolt-elements-borderColor',
                    'text-bolt-elements-textSecondary',
                    'cursor-not-allowed',
                  )}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
