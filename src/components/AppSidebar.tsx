import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Settings,
  LogOut,
  UserPlus,
  FileText,
  CalendarDays,
  DollarSign,
  MessageSquare,
  Palette,
  ChevronDown,
  Contact,
  Zap,
  Building2,
  Dumbbell,
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyFeatures } from "@/hooks/useCompanyFeatures";
import { useRolePermissions, type PermissionModule } from "@/hooks/useRolePermissions";
import { useTheme } from "@/contexts/ThemeContext";
import { useMaster } from "@/contexts/MasterContext";
import { useLocation, useNavigate } from "react-router-dom";
import bnLogo from "@/assets/bn-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

// Map sidebar items to permission modules
const moduleMap: Record<string, PermissionModule> = {
  "Dashboard": "dashboard",
  "Cadastro": "registration",
  "Anamnese": "anamnesis",
  "Alunos": "students",
  "Agenda": "agenda",
  "Exercícios": "exercises",
  "Planos": "plans",
  "Financeiro": "financial",
  "Aparência": "appearance",
  "Equipe": "team",
};

const masterItems = [
  { title: "Dashboard", url: "/master", icon: LayoutDashboard },
  { title: "Empresas", url: "/master/companies", icon: Building2 },
  { title: "Biblioteca de Exercícios", url: "/master/exercises", icon: Dumbbell },
];

const baseAdminItems: typeof managementItems = [];

const managementItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Cadastro", url: "/admin/registration", icon: UserPlus },
  { title: "Anamnese", url: "/admin/anamnesis", icon: FileText },
  { title: "Planos", url: "/admin/plans", icon: ClipboardList },
  { title: "Alunos", url: "/admin/students", icon: Users },
  { title: "Equipe", url: "/admin/team", icon: Users },
  { title: "Agenda", url: "/admin/agenda", icon: CalendarDays },
  { title: "Aparência", url: "/admin/appearance", icon: Palette },
];

const financialItem = { title: "Financeiro", url: "/admin/financial", icon: DollarSign };

const whatsappSubItems = [
  { title: "Conversas", url: "/admin/whatsapp-chat", icon: MessageSquare },
  { title: "CRM", url: "/admin/whatsapp-crm", icon: Contact },
  { title: "Templates", url: "/admin/whatsapp-templates", icon: FileText },
  { title: "Automação", url: "/admin/whatsapp-automation", icon: Zap },
  { title: "Configurações", url: "/admin/whatsapp", icon: Settings },
];

const coordinatorAllItems = [
  { title: "Dashboard", url: "/coordinator", icon: LayoutDashboard },
  { title: "Cadastro", url: "/coordinator/registration", icon: UserPlus },
  { title: "Anamnese", url: "/coordinator/anamnesis", icon: FileText },
  { title: "Planos", url: "/coordinator/plans", icon: ClipboardList },
  { title: "Alunos", url: "/coordinator/students", icon: Users },
  { title: "Equipe", url: "/coordinator/team", icon: Users },
  { title: "Agenda", url: "/coordinator/agenda", icon: CalendarDays },
  { title: "Financeiro", url: "/coordinator/financial", icon: DollarSign },
  { title: "Aparência", url: "/coordinator/appearance", icon: Palette },
];

const coordinatorWhatsappSubItems = [
  { title: "Conversas", url: "/coordinator/whatsapp-chat", icon: MessageSquare },
  { title: "CRM", url: "/coordinator/whatsapp-crm", icon: Contact },
  { title: "Templates", url: "/coordinator/whatsapp-templates", icon: FileText },
  { title: "Automação", url: "/coordinator/whatsapp-automation", icon: Zap },
  { title: "Configurações", url: "/coordinator/whatsapp", icon: Settings },
];

const trainerWhatsappSubItems = [
  { title: "Conversas", url: "/trainer/whatsapp-chat", icon: MessageSquare },
  { title: "CRM", url: "/trainer/whatsapp-crm", icon: Contact },
  { title: "Templates", url: "/trainer/whatsapp-templates", icon: FileText },
  { title: "Automação", url: "/trainer/whatsapp-automation", icon: Zap },
  { title: "Configurações", url: "/trainer/whatsapp", icon: Settings },
];

const trainerAllItems = [
  { title: "Dashboard", url: "/trainer", icon: LayoutDashboard },
  { title: "Cadastro", url: "/trainer/registration", icon: UserPlus },
  { title: "Anamnese", url: "/trainer/anamnesis", icon: FileText },
  { title: "Planos", url: "/trainer/plans", icon: ClipboardList },
  { title: "Alunos", url: "/trainer/students", icon: Users },
  { title: "Equipe", url: "/trainer/team", icon: Users },
  { title: "Agenda", url: "/trainer/agenda", icon: CalendarDays },
  { title: "Financeiro", url: "/trainer/financial", icon: DollarSign },
  { title: "Aparência", url: "/trainer/appearance", icon: Palette },
];

export function AppSidebar() {
  const { role, signOut, user } = useAuth();
  const features = useCompanyFeatures();
  const { canAccess } = useRolePermissions();
  const { settings } = useTheme();
  const { viewingCompany, isViewingCompany, exitCompanyView } = useMaster();
  const location = useLocation();
  const navigate = useNavigate();
  const logoSrc = settings?.logo_url || bnLogo;
  const title = settings?.platform_title || "BN PERFORMANCE";

  const isMaster = role === "master";
  const isAdmin = role === "admin";
  const isCoordinator = role === "coordinator";
  const isTrainer = role === "trainer";
  
  const showAdminView = isMaster && isViewingCompany;

  // Build admin items dynamically based on tier features
  const adminItems = (() => {
    const items = [...baseAdminItems];
    if (features.hasDashboard || showAdminView) {
      items.unshift(...managementItems);
    }
    if (features.hasFinancial || showAdminView) {
      items.push(financialItem);
    }
    return items;
  })();

  // For coordinator/trainer, filter items by permission
  const filterByPermission = (items: typeof coordinatorAllItems) => {
    return items.filter((item) => {
      const mod = moduleMap[item.title];
      if (!mod) return true; // If no mapping, show it
      return canAccess(mod);
    });
  };

  const items = showAdminView
    ? adminItems
    : isMaster
      ? masterItems
      : isAdmin
        ? adminItems
        : isCoordinator
          ? filterByPermission(coordinatorAllItems)
          : isTrainer
            ? filterByPermission(trainerAllItems)
            : [];

  const isWhatsAppActive = location.pathname.includes("/whatsapp");
  const isExercisesActive = location.pathname.includes("/exercises") || location.pathname.includes("/prescriptions") || location.pathname.includes("/workout/");
  
  // Determine exercise menu prefix
  const exercisePrefix = showAdminView ? "/admin" : `/${role}`;
  const showExercises = !isMaster || isViewingCompany; // Don't show collapsible for pure master view
  const canAccessExercises = isAdmin || showAdminView || (isCoordinator && canAccess("exercises")) || (isTrainer && canAccess("exercises"));

  const showWhatsApp = ((isAdmin || showAdminView) && (features.hasWhatsApp || showAdminView))
    || (isCoordinator && features.hasWhatsApp && canAccess("whatsapp"))
    || (isTrainer && features.hasWhatsApp && canAccess("whatsapp"));
  const activeWhatsappItems = isCoordinator
    ? coordinatorWhatsappSubItems
    : isTrainer
      ? trainerWhatsappSubItems
      : whatsappSubItems;

  const handleExitCompanyView = () => {
    exitCompanyView();
    navigate("/master");
  };

  const roleLabel = showAdminView 
    ? `Visualizando: ${viewingCompany?.name}` 
    : isMaster 
      ? "Master" 
      : role || "...";

  return (
    <Sidebar className="border-r border-border">
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <img src={logoSrc} alt={title} className="h-10 w-10 object-contain" />
        <div className="flex-1 min-w-0">
          <h2 className="text-primary text-lg leading-none tracking-wider truncate">{title}</h2>
          <p className="text-muted-foreground text-xs font-sans mt-0.5 truncate">{roleLabel}</p>
        </div>
        {showAdminView && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExitCompanyView}
            className="shrink-0"
            title="Voltar ao painel Master"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground font-sans text-xs uppercase tracking-widest">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url.split("/").length <= 2}
                      className="hover:bg-muted/50 text-sidebar-foreground font-sans"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Exercícios collapsible */}
              {showExercises && canAccessExercises && (
                <Collapsible defaultOpen={isExercisesActive} className="group/exercises">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full">
                        <Dumbbell className="mr-2 h-4 w-4" />
                        <span className="flex-1 text-left">Exercícios</span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/exercises:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location.pathname === `${exercisePrefix}/exercises`}>
                            <NavLink to={`${exercisePrefix}/exercises`} end>
                              <BookOpen className="h-4 w-4" />
                              <span>Biblioteca</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location.pathname === `${exercisePrefix}/prescriptions`}>
                            <NavLink to={`${exercisePrefix}/prescriptions`} end>
                              <ClipboardCheck className="h-4 w-4" />
                              <span>Prescrição</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}


              {showWhatsApp && activeWhatsappItems.length > 0 && (
                <Collapsible defaultOpen={isWhatsAppActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        <span className="flex-1 text-left">WhatsApp</span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {activeWhatsappItems.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton asChild isActive={location.pathname === item.url}>
                              <NavLink to={item.url} end>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground font-sans truncate mb-2">
          {user?.email}
        </p>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors font-sans w-full"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
