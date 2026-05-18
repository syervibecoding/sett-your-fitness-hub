import { Link } from "react-router-dom";
import logoSet from "@/assets/logo-set.jpg";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "default" | "inverted";
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  sublabel?: string;
  asLink?: boolean;
  to?: string;
  className?: string;
}

const sizeMap = {
  sm: { mark: "h-6 w-6", word: "text-xl" },
  md: { mark: "h-8 w-8", word: "text-2xl" },
  lg: { mark: "h-10 w-10", word: "text-3xl" },
};

export function Logo({
  variant = "default",
  size = "md",
  showWordmark = true,
  sublabel,
  asLink = false,
  to = "/",
  className,
}: LogoProps) {
  const s = sizeMap[size];
  const inverted = variant === "inverted";

  const inner = (
    <div className={cn("flex items-center gap-2", className)}>
      <img
        src={logoSet}
        alt="Set Training App"
        className={cn(
          s.mark,
          "object-contain",
          // White JPG bg: multiply blends it out on light surfaces;
          // invert + multiply gives a white-on-dark mark for the Ink footer.
          inverted ? "invert mix-blend-screen" : "mix-blend-multiply"
        )}
      />
      {showWordmark && (
        <div className="flex items-baseline gap-2 leading-none">
          <span
            className={cn(
              "font-display italic",
              s.word,
              inverted ? "text-paper" : "text-navy"
            )}
          >
            Set
          </span>
          {sublabel && (
            <span
              className={cn(
                "font-mono text-[10px] tracking-[0.2em] uppercase",
                inverted ? "text-paper/50" : "text-muted-foreground"
              )}
            >
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );

  return asLink ? <Link to={to}>{inner}</Link> : inner;
}
