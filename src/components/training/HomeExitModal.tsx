"use client";

function stopAllActiveMediaStreams() {
  if (typeof window === "undefined") return;

  const mediaElements = Array.from(
    document.querySelectorAll("video, audio"),
  ) as Array<HTMLVideoElement | HTMLAudioElement>;

  for (const element of mediaElements) {
    const stream = element.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
      element.srcObject = null;
    }

    try {
      element.pause();
    } catch {}
  }
}

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function HomeExitModal({ open, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px] flex items-center justify-center overflow-y-auto p-4">
      <div className="my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-3xl border border-orange-100 p-6 shadow-2xl">
        <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.25em] mb-2">
          Home
        </p>
        <h3 className="text-xl font-black text-slate-900 mb-2 break-keep">
          홈으로 이동할까요?
        </h3>
        <p className="text-sm text-slate-600 font-bold mb-6">
          현재 진행상황이 저장됩니다.
        </p>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => {
              stopAllActiveMediaStreams();
              onConfirm();
            }}
            className="w-full py-3.5 rounded-2xl bg-[#0B1A3A] text-white font-black hover:bg-[#09152f] transition-all"
          >
            홈으로 이동
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3.5 rounded-2xl bg-white text-gray-600 border border-gray-200 font-black hover:bg-gray-50 transition-all"
          >
            계속 진행
          </button>
        </div>
      </div>
    </div>
  );
}
