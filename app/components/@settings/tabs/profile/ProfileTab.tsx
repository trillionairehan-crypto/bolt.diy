import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { profileStore, updateProfile } from '~/lib/stores/profile';
import { authUserStore, signOut } from '~/lib/stores/auth';
import { getPlatformAuthHeaders } from '~/lib/supabase/platformAuthHeader';
import { SettingSection } from '~/components/@settings/shared/components/SettingSection';
import { SettingRow, SettingReadOnlyValue } from '~/components/@settings/shared/components/SettingRow';
import { AutoSaveField } from '~/components/@settings/shared/components/AutoSaveField';
import { ConfirmationDialog } from '~/components/ui/Dialog';

export default function ProfileTab() {
  const profile = useStore(profileStore);
  const authUser = useStore(authUserStore);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);

    try {
      const headers = await getPlatformAuthHeaders();

      if (!headers.Authorization) {
        toast.error('로그인이 필요해요.');
        setIsDeleting(false);

        return;
      }

      const response = await fetch('/api/account-delete', { method: 'POST', headers });

      if (!response.ok) {
        const body = await response.json<{ error?: string }>().catch(() => ({}) as { error?: string });
        toast.error(body.error ?? '탈퇴 처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
        setIsDeleting(false);

        return;
      }

      await signOut();
      window.location.href = '/';
    } catch {
      toast.error('탈퇴 처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
      setIsDeleting(false);
    }
  };

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
            onClick={handleLogout}
            className="text-sm font-medium hover:underline"
            style={{ color: '#1A1A1A' }}
          >
            로그아웃
          </button>
        </SettingRow>
        <SettingRow label="회원 탈퇴" description="계정과 만든 앱 기록이 모두 삭제되고 되돌릴 수 없어요.">
          <button
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-sm font-medium hover:underline"
            style={{ color: '#B8391E' }}
          >
            회원 탈퇴
          </button>
        </SettingRow>
      </SettingSection>

      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteAccount}
        title="정말 탈퇴하시겠어요?"
        description="계정과 만든 앱 기록이 모두 삭제돼요. 이 작업은 되돌릴 수 없어요."
        confirmLabel="탈퇴하기"
        cancelLabel="취소"
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
