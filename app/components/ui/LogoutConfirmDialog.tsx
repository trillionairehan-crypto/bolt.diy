import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from './Dialog';

interface LogoutConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 로그아웃 확인 — 로그아웃하면 이 기기의 IndexedDB 대화 기록도 함께 지워지므로(auth.ts의
 * clearLocalChatHistory, 공용 PC 개인정보 조치) 실행 전에 반드시 안내한다. Menu.client.tsx의
 * 대화 삭제 확인 다이얼로그와 같은 톤(크림/잉크, danger 버튼)으로 맞춘다.
 */
export function LogoutConfirmDialog({ open, onCancel, onConfirm }: LogoutConfirmDialogProps) {
  return (
    <DialogRoot open={open}>
      <Dialog onBackdrop={onCancel} onClose={onCancel}>
        <div className="p-6" style={{ background: '#FBF5EE' }}>
          <DialogTitle style={{ color: '#1A1A1A' }}>로그아웃할까요?</DialogTitle>
          <DialogDescription className="mt-2" style={{ color: '#8B7E70' }}>
            <p>이 기기에 저장된 작업 내역도 함께 지워져요.</p>
            <p className="mt-2">삭제하면 되돌릴 수 없어요.</p>
          </DialogDescription>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4" style={{ background: '#F5EDE3' }}>
          <DialogButton type="secondary" onClick={onCancel}>
            취소
          </DialogButton>
          <DialogButton type="danger" onClick={onConfirm}>
            로그아웃
          </DialogButton>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
