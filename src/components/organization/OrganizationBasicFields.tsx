"use client";

import type { ChangeEvent, ReactNode } from "react";

/**
 * 기관 식별 / 주소 / 사업자등록증 공통 입력 블록.
 *
 * 두 경로에서 재사용:
 *   - /signup 의 1인 기업(solo) 치료사 가입
 *   - /organization-register 의 단독 기관 등록 요청
 *
 * 서버는 두 경로 모두 동일한 createOrganizationRegistrationRequest 를 거치므로
 * 이 컴포넌트가 수집하는 필드는 서버 저장 스키마와 1:1 로 대응한다.
 */

export type OrganizationBasicFieldsValue = {
  organizationName: string;
  businessNumber: string;
  representativeName: string;
  organizationType: string;
  careInstitutionNumber: string;
  businessLicenseFileName: string;
  businessLicenseFileDataUrl: string;
  organizationPhone: string;
  postalCode: string;
  roadAddress: string;
  addressDetail: string;
};

export const EMPTY_ORGANIZATION_BASIC_FIELDS: OrganizationBasicFieldsValue = {
  organizationName: "",
  businessNumber: "",
  representativeName: "",
  organizationType: "",
  careInstitutionNumber: "",
  businessLicenseFileName: "",
  businessLicenseFileDataUrl: "",
  organizationPhone: "",
  postalCode: "",
  roadAddress: "",
  addressDetail: "",
};

export const ORGANIZATION_TYPE_OPTIONS = [
  "병원",
  "의원",
  "재활병원",
  "요양기관",
  "언어치료실",
  "복지관",
  "기타",
] as const;

export type OrganizationBasicFieldsProps = {
  value: OrganizationBasicFieldsValue;
  onChange: (patch: Partial<OrganizationBasicFieldsValue>) => void;
  onLicenseFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  isReadingLicense?: boolean;
  /** 주소 섹션을 보여줄지 여부. 기본 true. */
  showAddress?: boolean;
  /** 상단에 추가로 넣을 보조 UI (예: 에러 메시지, 안내 문구) */
  extraHeader?: ReactNode;
};

/** 사업자등록번호를 123-45-67890 형식으로 포맷 */
export function formatBusinessNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 10)}`;
}

/** 전화번호에서 숫자/하이픈만 남기고 최대 13자까지 */
export function normalizeOrganizationPhone(value: string) {
  return value.replace(/[^\d-]/g, "").slice(0, 13);
}

/**
 * 공통 필드 검증. 에러 메시지 한 줄을 반환하거나, 문제 없으면 null.
 * 주소/전화는 현재는 선택 입력이라 검증하지 않음 (서버 쪽 폴백이 처리).
 */
export function validateOrganizationBasicFields(
  v: OrganizationBasicFieldsValue,
): string | null {
  if (!v.organizationName.trim()) return "기관명을 입력해 주세요.";
  if (!v.businessNumber.trim()) return "사업자등록번호를 입력해 주세요.";
  if (v.businessNumber.replace(/\D/g, "").length !== 10) {
    return "사업자등록번호는 10자리 숫자로 입력해 주세요.";
  }
  if (!v.representativeName.trim()) return "대표자명을 입력해 주세요.";
  if (!v.organizationType.trim()) return "기관 유형을 선택해 주세요.";
  if (!v.careInstitutionNumber.trim()) return "요양기관번호를 입력해 주세요.";
  if (!v.businessLicenseFileName.trim()) return "사업자등록증을 업로드해 주세요.";
  return null;
}

const inputCls =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-orange-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(249,115,22,0.12)]";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function OrganizationBasicFields({
  value,
  onChange,
  onLicenseFileChange,
  isReadingLicense = false,
  showAddress = true,
  extraHeader,
}: OrganizationBasicFieldsProps) {
  return (
    <div className="space-y-6">
      {extraHeader}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="기관명 *">
          <input
            className={inputCls}
            value={value.organizationName}
            onChange={(event) => onChange({ organizationName: event.target.value })}
            placeholder="정식 기관명 또는 병원명"
          />
        </Field>
        <Field label="사업자등록번호 *">
          <input
            className={inputCls}
            value={value.businessNumber}
            onChange={(event) =>
              onChange({ businessNumber: formatBusinessNumber(event.target.value) })
            }
            placeholder="123-45-67890"
          />
        </Field>
        <Field label="대표자명 *">
          <input
            className={inputCls}
            value={value.representativeName}
            onChange={(event) => onChange({ representativeName: event.target.value })}
            placeholder="대표자명"
          />
        </Field>
        <Field label="기관 유형 *">
          <select
            className={inputCls}
            value={value.organizationType}
            onChange={(event) => onChange({ organizationType: event.target.value })}
          >
            <option value="">기관 유형 선택</option>
            {ORGANIZATION_TYPE_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="요양기관번호 *">
          <input
            className={inputCls}
            value={value.careInstitutionNumber}
            onChange={(event) => onChange({ careInstitutionNumber: event.target.value })}
            placeholder="건보 기준 요양기관번호"
          />
        </Field>
        <Field label="사업자등록증 업로드 *">
          <input
            className={`${inputCls} file:mr-3 file:rounded-xl file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:text-sm file:font-black file:text-orange-700`}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={onLicenseFileChange}
          />
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {isReadingLicense
              ? "파일을 읽는 중입니다..."
              : value.businessLicenseFileName
                ? `첨부됨: ${value.businessLicenseFileName}`
                : "PDF, JPG, PNG / 최대 5MB"}
          </p>
        </Field>
      </div>

      {showAddress ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="기관 대표 연락처">
            <input
              className={inputCls}
              value={value.organizationPhone}
              onChange={(event) =>
                onChange({
                  organizationPhone: normalizeOrganizationPhone(event.target.value),
                })
              }
              placeholder="선택 입력"
            />
          </Field>
          <Field label="우편번호">
            <input
              className={inputCls}
              value={value.postalCode}
              onChange={(event) =>
                onChange({ postalCode: event.target.value.replace(/\D/g, "").slice(0, 6) })
              }
              placeholder="선택 입력"
            />
          </Field>
          <Field label="도로명 주소">
            <input
              className={inputCls}
              value={value.roadAddress}
              onChange={(event) => onChange({ roadAddress: event.target.value })}
              placeholder="선택 입력"
            />
          </Field>
          <Field label="상세 주소">
            <input
              className={inputCls}
              value={value.addressDetail}
              onChange={(event) => onChange({ addressDetail: event.target.value })}
              placeholder="선택 입력"
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
