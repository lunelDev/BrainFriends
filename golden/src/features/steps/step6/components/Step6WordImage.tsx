import React, { useEffect, useMemo, useState } from "react";
import { PlaceType } from "@/constants/trainingData";
import { buildStep6ImageCandidates } from "@/features/steps/step6/utils";

type Props = {
  place: PlaceType;
  answer: string;
  className: string;
  imgClassName: string;
  onClick?: () => void;
  zoomLabel?: string;
};

export function Step6WordImage({
  place,
  answer,
  className,
  imgClassName,
  onClick,
  zoomLabel,
}: Props) {
  const candidates = useMemo(
    () => buildStep6ImageCandidates(place, answer),
    [place, answer],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [place, answer]);

  const src = candidates[candidateIndex];
  const content = (
    <>
      {src ? (
        <img
          src={src}
          alt={answer}
          className={imgClassName}
          onError={() => {
            setCandidateIndex((prev) =>
              prev < candidates.length - 1 ? prev + 1 : prev,
            );
          }}
        />
      ) : (
        <div className="text-slate-400 font-black text-lg">{answer.slice(0, 1)}</div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} cursor-zoom-in`}
        aria-label={zoomLabel || `${answer} 이미지 보기`}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
