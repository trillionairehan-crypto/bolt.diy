import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { profileStore, updateProfile } from '~/lib/stores/profile';
import { authUserStore, signOut } from '~/lib/stores/auth';
import { SettingSection } from '~/components/@settings/shared/components/SettingSection';
import { SettingRow, SettingReadOnlyValue } from '~/components/@settings/shared/components/SettingRow';
import { AutoSaveField } from '~/components/@settings/shared/components/AutoSaveField';

export default function ProfileTab() {
  const profile = useStore(profileStore);
  const authUser = useStore(authUserStore);
  const [isUploading, setIsUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();

    reader.onloadend = () => {
      updateProfile({ avatar: reader.result as string });
      setIsUploading(false);
    };

    reader.onerror = () => {
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-10">
      <SettingSection title="프로필">
        {/* 10-3: the circular image itself is the upload trigger — no separate button. */}
        <SettingRow label="프로필 사진">
          <label
            className={classNames(
              'relative w-12 h-12 rounded-full overflow-hidden inline-flex items-center justify-center cursor-pointer group',
              isUploading ? 'cursor-wait' : '',
            )}
          >
            {profile.avatar ? (
              <img src={profile.avatar} alt="프로필" className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-lg font-semibold text-white"
                style={{ background: '#FF5330' }}
              >
                {(profile.username || authUser?.email || '?').trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
              {isUploading ? (
                <div className="i-ph:spinner-gap w-4 h-4 text-white animate-spin" />
              ) : (
                <div className="i-ph:camera-plus w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={isUploading}
            />
          </label>
        </SettingRow>

        <SettingRow label="이름">
          <AutoSaveField
            value={profile.username}
            placeholder="이름을 입력하세요"
            onSave={(value) => updateProfile({ username: value })}
          />
        </SettingRow>

        {authUser?.email && (
          <SettingRow label="이메일">
            <SettingReadOnlyValue>{authUser.email}</SettingReadOnlyValue>
          </SettingRow>
        )}
      </SettingSection>

      <SettingSection title="계정">
        <SettingRow label="로그아웃">
          <button
            type="button"
            onClick={() => signOut()}
            className="text-sm font-medium hover:underline"
            style={{ color: '#1A1A1A' }}
          >
            로그아웃
          </button>
        </SettingRow>
      </SettingSection>
    </div>
  );
}
