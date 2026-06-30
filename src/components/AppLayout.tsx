import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { RouteTransition } from "@/components/RouteTransition";
import { AICoachWidget } from "@/components/ai/AICoachWidget";

const ContentLoader = () => (
  <div className="flex items-center justify-center py-24">
    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

export function AppLayout() {
  const location = useLocation();
  const noPadding =
    location.pathname.includes("/whatsapp-chat") ||
    location.pathname.includes("/whatsapp-automation");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-paper">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-4 border-b border-line px-6 bg-paper">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Set / Painel
            </span>
          </header>
          <div className={`flex-1 overflow-auto ${noPadding ? "" : "p-6 md:p-8"}`}>
            <Suspense fallback={<ContentLoader />}>
              <RouteTransition>
                <Outlet />
              </RouteTransition>
            </Suspense>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
