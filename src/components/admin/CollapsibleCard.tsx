import { ReactNode, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

// Card com cabeçalho clicável que recolhe/expande o conteúdo (menu suspenso).
// Use para seções longas/secundárias, deixando só o essencial aberto.
export function CollapsibleCard({
  title,
  icon,
  defaultOpen = false,
  action,
  children,
  className,
  contentClassName,
}: {
  title: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  action?: ReactNode; // botões/contexto que ficam à direita, fora do trigger
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className={`bg-card border-border ${className || ""}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-primary text-lg font-semibold text-left">
              {icon}
              <span className="flex-1">{title}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            {action}
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className={contentClassName}>{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
