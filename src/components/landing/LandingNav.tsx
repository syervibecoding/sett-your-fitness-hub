import { Link } from "react-router-dom";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur">
      <nav className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl text-navy leading-none">Set</span>
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            Training App
          </span>
        </Link>
        <div className="flex items-center gap-6">
          <a href="#diferenciais" className="hidden sm:block font-mono text-xs tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors">
            Diferenciais
          </a>
          <a href="#planos" className="hidden sm:block font-mono text-xs tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors">
            Planos
          </a>
          <Link
            to="/auth"
            className="font-mono text-xs tracking-wider uppercase border border-foreground px-3 py-1.5 hover:bg-foreground hover:text-paper transition-colors"
          >
            Acessar →
          </Link>
        </div>
      </nav>
    </header>
  );
}
