// ============================================================================
// ui.tsx — Componentes UI self-contained (sem shadcn/Radix)
// API compatível com o que os componentes usam
// ============================================================================
import React, { createContext, useContext, useState, useRef, useEffect } from "react";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

// ── Card ──────────────────────────────────────────────────────────────────
export const Card = ({ className = "", children }: any) => (
  <div className={cx("bg-white border border-slate-200 rounded-xl", className)}>{children}</div>
);
export const CardHeader = ({ className = "", children }: any) => (
  <div className={cx("px-5 pt-5 pb-2", className)}>{children}</div>
);
export const CardTitle = ({ className = "", children }: any) => (
  <h3 className={cx("font-semibold text-slate-800", className)}>{children}</h3>
);
export const CardContent = ({ className = "", children }: any) => (
  <div className={cx("px-5 pb-5", className)}>{children}</div>
);

// ── Button ────────────────────────────────────────────────────────────────
export const Button = ({ className = "", variant = "default", size = "default", disabled, onClick, children, ...rest }: any) => {
  const variants: Record<string, string> = {
    default: "bg-navy text-white hover:bg-navy/90",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-700 hover:bg-slate-100",
  };
  const sizes: Record<string, string> = {
    default: "h-10 px-4 text-sm",
    sm: "h-8 px-3 text-xs",
  };
  return (
    <button onClick={onClick} disabled={disabled} {...rest}
      className={cx("inline-flex items-center justify-center rounded-lg font-medium transition disabled:opacity-50 disabled:pointer-events-none",
        variants[variant], sizes[size], className)}>
      {children}
    </button>
  );
};

// ── Input ─────────────────────────────────────────────────────────────────
export const Input = ({ className = "", ...rest }: any) => (
  <input {...rest}
    className={cx("w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-800 focus:outline-none focus:border-bege focus:ring-1 focus:ring-bege placeholder:text-slate-400", className)} />
);

// ── Textarea ──────────────────────────────────────────────────────────────
export const Textarea = ({ className = "", ...rest }: any) => (
  <textarea {...rest}
    className={cx("w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:outline-none focus:border-bege focus:ring-1 focus:ring-bege placeholder:text-slate-400", className)} />
);

// ── Label ─────────────────────────────────────────────────────────────────
export const Label = ({ className = "", children }: any) => (
  <label className={cx("block text-sm font-medium text-slate-700", className)}>{children}</label>
);

// ── Badge ─────────────────────────────────────────────────────────────────
export const Badge = ({ className = "", variant = "default", children }: any) => {
  const v: Record<string, string> = {
    default: "bg-navy text-white",
    outline: "border border-slate-300 text-slate-600",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", v[variant], className)}>{children}</span>;
};

// ── Checkbox ──────────────────────────────────────────────────────────────
export const Checkbox = ({ checked, onCheckedChange, id, className = "" }: any) => (
  <button
    type="button" id={id} role="checkbox" aria-checked={checked}
    onClick={() => onCheckedChange?.(!checked)}
    className={cx("h-4 w-4 rounded border flex items-center justify-center transition flex-shrink-0",
      checked ? "bg-bege border-bege" : "bg-white border-slate-300", className)}>
    {checked && (
      <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none">
        <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </button>
);

// ── Select (custom dropdown com context) ────────────────────────────────────
const SelectCtx = createContext<any>(null);

export const Select = ({ value, onValueChange, children }: any) => {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <SelectCtx.Provider value={{ value, onValueChange, open, setOpen, labels, setLabels }}>
      <div ref={ref} className="relative">{children}</div>
    </SelectCtx.Provider>
  );
};

export const SelectTrigger = ({ className = "", children }: any) => {
  const { open, setOpen } = useContext(SelectCtx);
  return (
    <button type="button" onClick={() => setOpen(!open)}
      className={cx("w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-800 flex items-center justify-between focus:outline-none focus:border-bege bg-white", className)}>
      {children}
      <svg viewBox="0 0 12 12" className="h-3 w-3 text-slate-400 ml-2" fill="none">
        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
};

export const SelectValue = ({ placeholder }: any) => {
  const { value, labels } = useContext(SelectCtx);
  const label = labels?.[value];
  return <span className={cx(!value && "text-slate-400")}>{label || value || placeholder}</span>;
};

export const SelectContent = ({ children }: any) => {
  const { open, setLabels } = useContext(SelectCtx);
  // Coleta labels dos items
  const labels: Record<string, string> = {};
  React.Children.forEach(children, (child: any) => {
    if (child?.props?.value !== undefined) labels[child.props.value] = child.props.children;
  });
  useEffect(() => { setLabels(labels); }, [children]);
  if (!open) return null;
  return (
    <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto py-1">
      {children}
    </div>
  );
};

export const SelectItem = ({ value, children }: any) => {
  const { onValueChange, setOpen, value: selected } = useContext(SelectCtx);
  return (
    <button type="button"
      onClick={() => { onValueChange?.(value); setOpen(false); }}
      className={cx("w-full text-left px-3 py-2 text-sm hover:bg-slate-50",
        selected === value ? "text-bege font-medium" : "text-slate-700")}>
      {children}
    </button>
  );
};

// ── Tabs ──────────────────────────────────────────────────────────────────
const TabsCtx = createContext<any>(null);

export const Tabs = ({ value, onValueChange, children, className = "" }: any) => (
  <TabsCtx.Provider value={{ value, onValueChange }}>
    <div className={className}>{children}</div>
  </TabsCtx.Provider>
);

export const TabsList = ({ className = "", children }: any) => (
  <div className={cx("inline-flex rounded-lg bg-slate-100 p-1 gap-1", className)}>{children}</div>
);

export const TabsTrigger = ({ value, children }: any) => {
  const { value: active, onValueChange } = useContext(TabsCtx);
  return (
    <button type="button" onClick={() => onValueChange(value)}
      className={cx("flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition",
        active === value ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, className = "" }: any) => {
  const { value: active } = useContext(TabsCtx);
  if (active !== value) return null;
  return <div className={className}>{children}</div>;
};
