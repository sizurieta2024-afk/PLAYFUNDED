"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import { submitKyc } from "@/app/actions/kyc";
import type { IdType } from "@prisma/client";

const COUNTRIES = [
  { code: "MX", label: "México" },
  { code: "AR", label: "Argentina" },
  { code: "CO", label: "Colombia" },
  { code: "CL", label: "Chile" },
  { code: "PE", label: "Perú" },
  { code: "BR", label: "Brasil" },
  { code: "EC", label: "Ecuador" },
  { code: "VE", label: "Venezuela" },
  { code: "BO", label: "Bolivia" },
  { code: "UY", label: "Uruguay" },
  { code: "PY", label: "Paraguay" },
  { code: "CR", label: "Costa Rica" },
  { code: "GT", label: "Guatemala" },
  { code: "PA", label: "Panamá" },
  { code: "DO", label: "República Dominicana" },
  { code: "HN", label: "Honduras" },
  { code: "SV", label: "El Salvador" },
  { code: "NI", label: "Nicaragua" },
  { code: "OTHER", label: "Other" },
];

interface KycFormProps {
  t: Record<string, string>;
}

interface FileState {
  path?: string;
  uploading: boolean;
  error?: string;
}

export function KycForm({ t }: KycFormProps) {
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [country, setCountry] = useState("");
  const [idType, setIdType] = useState<IdType>("national_id");
  const [frontFile, setFrontFile] = useState<FileState>({ uploading: false });
  const [backFile, setBackFile] = useState<FileState>({ uploading: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  async function uploadFile(
    file: File,
    setter: (s: FileState) => void,
  ): Promise<string | null> {
    if (file.size > 10 * 1024 * 1024) {
      setter({ uploading: false, error: t.fileTooBig });
      return null;
    }
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setter({ uploading: false, error: t.fileWrongType });
      return null;
    }
    setter({ uploading: true });
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/kyc/upload", { method: "POST", body: fd });
    if (!res.ok) {
      setter({ uploading: false, error: "Upload failed" });
      return null;
    }
    const data = (await res.json()) as { path?: string; error?: string };
    if (!data.path) {
      setter({ uploading: false, error: data.error ?? "Upload failed" });
      return null;
    }
    setter({ uploading: false, path: data.path });
    return data.path;
  }

  async function handleFrontChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file, setFrontFile);
  }

  async function handleBackChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file, setBackFile);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullName.trim() || !dateOfBirth || !country || !frontFile.path) {
      setError(t.required);
      return;
    }

    setSubmitting(true);
    const result = await submitKyc({
      fullName: fullName.trim(),
      dateOfBirth,
      country,
      idType,
      idFrontPath: frontFile.path,
      idBackPath: backFile.path,
    });
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <CheckCircle className="w-12 h-12 text-pf-brand" />
        <p className="font-semibold text-foreground">{t.submitted}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {t.fullName}
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t.fullNamePlaceholder}
          required
          className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-pf-brand/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t.dateOfBirth}
          </label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pf-brand/40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t.country}
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-pf-brand/40"
          >
            <option value="">{t.countryPlaceholder}</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {t.idType}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: "passport", label: t.passport },
              { id: "national_id", label: t.nationalId },
              { id: "drivers_license", label: t.driversLicense },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setIdType(id)}
              className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-center ${
                idType === id
                  ? "border-pf-brand bg-pf-brand/10 text-pf-brand"
                  : "border-border text-muted-foreground hover:border-pf-brand/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Front upload */}
      <FileUploadField
        label={t.idFront}
        desc={t.idFrontDesc}
        state={frontFile}
        uploadLabel={t.uploadFile}
        uploadedLabel={t.fileUploaded}
        inputRef={frontRef}
        onChange={handleFrontChange}
      />

      {/* Back upload */}
      <FileUploadField
        label={t.idBack}
        desc={t.idBackDesc}
        state={backFile}
        uploadLabel={t.uploadFile}
        uploadedLabel={t.fileUploaded}
        inputRef={backRef}
        onChange={handleBackChange}
        optional
      />

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || frontFile.uploading || backFile.uploading}
        className="w-full rounded-xl bg-pf-brand hover:bg-pf-brand/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition-colors"
      >
        {submitting ? t.submitting : t.submit}
      </button>
    </form>
  );
}

function FileUploadField({
  label,
  desc,
  state,
  uploadLabel,
  uploadedLabel,
  inputRef,
  onChange,
  optional = false,
}: {
  label: string;
  desc: string;
  state: FileState;
  uploadLabel: string;
  uploadedLabel: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label}
        {optional && (
          <span className="text-muted-foreground font-normal ml-1">
            (optional)
          </span>
        )}
      </label>
      <p className="text-xs text-muted-foreground mb-2">{desc}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        className="hidden"
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state.uploading}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
          state.path
            ? "border-pf-brand/40 bg-pf-brand/10 text-pf-brand"
            : "border-border text-muted-foreground hover:border-pf-brand/40 hover:text-foreground"
        }`}
      >
        {state.path ? (
          <>
            <CheckCircle className="w-4 h-4" />
            {uploadedLabel}
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            {state.uploading ? "Uploading..." : uploadLabel}
          </>
        )}
      </button>
      {state.error && (
        <p className="text-red-400 text-xs mt-1">{state.error}</p>
      )}
    </div>
  );
}
