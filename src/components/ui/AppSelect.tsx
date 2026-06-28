"use client";

import Select, { type SingleValue, type StylesConfig } from "react-select";

export interface SelectOption {
  value: string | number;
  label: string;
}

interface AppSelectProps {
  options: SelectOption[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  placeholder?: string;
  isClearable?: boolean;
  size?: "sm" | "md";
  width?: string;
  ariaLabel?: string;
}

const FONT = "var(--font-open-sans,'Open Sans',sans-serif)";

export function AppSelect({
  options,
  value,
  onChange,
  placeholder = "Seleccionar…",
  isClearable = false,
  size = "md",
  width,
  ariaLabel,
}: AppSelectProps) {
  const selected = options.find((o) => o.value === value) ?? null;
  const fs = size === "sm" ? "13px" : "14px";
  const minH = size === "sm" ? 34 : 38;
  const radius = size === "sm" ? "8px" : "10px";

  const styles: StylesConfig<SelectOption, false> = {
    control: (base, state) => ({
      ...base,
      minHeight: `${minH}px`,
      borderRadius: radius,
      border: state.isFocused ? "1.5px solid #0a0a0a" : "1.5px solid #e5e7eb",
      boxShadow: "none",
      fontFamily: FONT,
      fontSize: fs,
      cursor: "pointer",
      "&:hover": { borderColor: state.isFocused ? "#0a0a0a" : "#d1d5db" },
    }),
    valueContainer: (base) => ({ ...base, padding: "0 10px" }),
    input: (base) => ({ ...base, margin: 0, padding: 0 }),
    singleValue: (base) => ({ ...base, fontFamily: FONT, fontSize: fs, color: "#111827" }),
    placeholder: (base) => ({ ...base, color: "#9ca3af", fontFamily: FONT, fontSize: fs }),
    dropdownIndicator: (base) => ({ ...base, padding: size === "sm" ? "4px 6px" : "6px 8px", color: "#9ca3af" }),
    indicatorSeparator: () => ({ display: "none" }),
    option: (base, state) => ({
      ...base,
      fontFamily: FONT,
      fontSize: fs,
      cursor: "pointer",
      backgroundColor: state.isSelected || state.isFocused ? "#0a0a0a" : "#fff",
      color: state.isSelected || state.isFocused ? "#fff" : "#111827",
      "&:active": { backgroundColor: "#0a0a0a" },
    }),
    menu: (base) => ({ ...base, borderRadius: "10px", overflow: "hidden", boxShadow: "0 8px 28px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  };

  return (
    <div style={width ? { width } : undefined}>
      <Select<SelectOption, false>
        options={options}
        value={selected}
        onChange={(opt: SingleValue<SelectOption>) => onChange(opt ? opt.value : null)}
        placeholder={placeholder}
        isClearable={isClearable}
        aria-label={ariaLabel}
        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
        menuPosition="fixed"
        menuPlacement="auto"
        styles={styles}
      />
    </div>
  );
}
