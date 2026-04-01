import { useEffect, useState, useCallback } from "react";
import { Trash2, UserPlus, Shield, KeyRound, Plus, Eye, EyeOff, Pencil, Users, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useMaster } from "@/contexts/MasterContext";
import { useManageRolePermissions, type PermissionModule } from "@/hooks/useRolePermissions";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TeamMember {
  user_id: string;
  full_name: string | null;
  email?: string;
  roles: string[];
}

interface ProfileOption {
  user_id: string;
  full_name: string | null;
}

interface TrainerPerformance {
  user_id: string;
  full_name: string;
  role: string;
  activeStudents: number;
  workoutsByMonth: Record<string, number>; // "YYYY-MM" -> count
}

const ALL_ROLES = ["admin", "coordinator", "trainer"] as const;
type Role = typeof ALL_ROLES[number];

const PERMISSION_MODULES: { key: PermissionModule; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "registration", label: "Cadastro" },
  { key: "anamnesis", label: "Anamnese" },
  { key: "students", label: "Alunos" },
  { key: "agenda", label: "Agenda" },
  { key: "exercises", label: "Exercícios" },
  { key: "plans", label: "Planos" },
  { key: "financial", label: "Financeiro" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "appearance", label: "Aparência" },
  { key: "team", label: "Equipe" },
];

const PERMISSION_ROLES = [
  { key: "coordinator", label: "Coordenador" },
  { key: "trainer", label: "Treinador" },
];

export default function TeamManager() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<ProfileOption[]>([]);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [newRole, setNewRole] = useState("");
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [passwordUserId, setPasswordUserId] = useState("");
  const [passwordUserName, setPasswordUserName] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [editUserId, setEditUserId] = useState("");
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editRoles, setEditRoles] = useState<string[]>([]);

  // Performance tab
  const [trainerPerformance, setTrainerPerformance] = useState<TrainerPerformance[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);

  const { toast } = useToast();
  const { companyId, role } = useAuth();
  const { viewingCompany, isViewingCompany } = useMaster();
  const effectiveCompanyId = role === "master" ? (isViewingCompany ? viewingCompany?.id : null) : companyId;
  const { isEnabled, togglePermission, loading: permLoading } = useManageRolePermissions(effectiveCompanyId);

  useEffect(() => {
    if (effectiveCompanyId) loadTeam();
  }, [effectiveCompanyId]);

  const loadTeam = async () => {
    if (!effectiveCompanyId) return;

    // Get company members first for isolation
    const { data: companyMembers } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", effectiveCompanyId);

    if (!companyMembers || companyMembers.length === 0) {
      setMembers([]);
      setAvailableUsers([]);
      return;
    }

    const companyUserIds = companyMembers.map((m) => m.user_id);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", companyUserIds);

    if (!roles) return;

    const userIds = [...new Set(roles.map((r) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const grouped: Record<string, TeamMember> = {};
    const excludeUserIds = new Set<string>();
    
    // Build a map of all roles per user
    const rolesByUser = new Map<string, string[]>();
    for (const r of roles) {
      if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, []);
      rolesByUser.get(r.user_id)!.push(r.role);
    }
    
    // Exclude masters and users with ONLY the student role
    for (const [uid, userRoles] of rolesByUser) {
      if (userRoles.includes("master")) excludeUserIds.add(uid);
      if (userRoles.length === 1 && userRoles[0] === "student") excludeUserIds.add(uid);
    }

    for (const r of roles) {
      if (excludeUserIds.has(r.user_id)) continue;
      if (r.role === "student") continue; // don't show student badge for team members
      if (!grouped[r.user_id]) {
        grouped[r.user_id] = {
          user_id: r.user_id,
          full_name: profiles?.find((p) => p.user_id === r.user_id)?.full_name || "Sem nome",
          roles: [],
        };
      }
      grouped[r.user_id].roles.push(r.role);
    }
    const membersList = Object.values(grouped);

    // Fetch emails via edge function
    if (membersList.length > 0) {
      try {
        const { data: emailData } = await supabase.functions.invoke("manage-team-member", {
          body: { action: "list-emails", user_ids: membersList.map((m) => m.user_id) },
        });
        if (emailData?.emails) {
          const emailMap = new Map(emailData.emails.map((e: any) => [e.user_id, e.email]));
          membersList.forEach((m) => {
            m.email = (emailMap.get(m.user_id) as string) || undefined;
          });
        }
      } catch (e) {
        console.error("Failed to fetch emails", e);
      }
    }

    setMembers(membersList);

    // Available users: only from this company
    const { data: companyProfiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", companyUserIds);

    if (companyProfiles) setAvailableUsers(companyProfiles);
  };

  const loadPerformance = useCallback(async () => {
    if (!effectiveCompanyId) return;
    setPerfLoading(true);

    // Get trainers in this company
    const { data: companyMembers } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", effectiveCompanyId);

    if (!companyMembers || companyMembers.length === 0) {
      setTrainerPerformance([]);
      setPerfLoading(false);
      return;
    }

    const companyUserIds = companyMembers.map((m) => m.user_id);

    const { data: memberRoles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["trainer", "coordinator", "admin"])
      .in("user_id", companyUserIds);

    if (!memberRoles || memberRoles.length === 0) {
      setTrainerPerformance([]);
      setPerfLoading(false);
      return;
    }

    // Deduplicate and build role map
    const roleMap = new Map<string, string>();
    for (const r of memberRoles) {
      // Keep highest priority role for display
      if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role);
    }
    const trainerIds = [...roleMap.keys()];

    // Get profiles, students, workouts in parallel
    const now = new Date();
    const months = [0, 1, 2].map((i) => {
      const d = subMonths(now, i);
      return { key: format(d, "yyyy-MM"), start: startOfMonth(d).toISOString(), end: endOfMonth(d).toISOString() };
    });

    const [profilesRes, studentsRes, workoutsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name").in("user_id", trainerIds),
      supabase.from("students").select("id, assigned_trainer_id").eq("company_id", effectiveCompanyId).eq("status", "active").in("assigned_trainer_id", trainerIds),
      supabase.from("workouts").select("id, created_by, created_at").eq("company_id", effectiveCompanyId).in("created_by", trainerIds).gte("created_at", months[2].start),
    ]);

    const profiles = profilesRes.data || [];
    const students = studentsRes.data || [];
    const workouts = workoutsRes.data || [];

    const performance: TrainerPerformance[] = trainerIds.map((tid) => {
      const profile = profiles.find((p) => p.user_id === tid);
      const activeStudents = students.filter((s) => s.assigned_trainer_id === tid).length;

      const workoutsByMonth: Record<string, number> = {};
      for (const m of months) workoutsByMonth[m.key] = 0;

      for (const w of workouts) {
        if (w.created_by !== tid) continue;
        const key = format(new Date(w.created_at), "yyyy-MM");
        if (workoutsByMonth[key] !== undefined) workoutsByMonth[key]++;
      }

      return {
        user_id: tid,
        full_name: profile?.full_name || "Sem nome",
        role: roleMap.get(tid) || "trainer",
        activeStudents,
        workoutsByMonth,
      };
    });

    setTrainerPerformance(performance);
    setPerfLoading(false);
  }, [effectiveCompanyId]);

  const handleAddRole = async () => {
    if (!userId || !newRole) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as Role });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Papel atribuído!" });
    setRoleDialogOpen(false);
    setUserId("");
    setNewRole("");
    loadTeam();
  };

  const handleRemoveRole = async (uid: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Papéis removidos" });
    loadTeam();
  };

  const handleCreateMember = async () => {
    if (!newName || !newEmail || !newPassword || !newMemberRole) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-team-member", {
      body: { action: "create", full_name: newName, email: newEmail, password: newPassword, role: newMemberRole, company_id: effectiveCompanyId },
    });
    setLoading(false);

    if (error || data?.error) {
      toast({ title: "Erro", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Membro criado com sucesso!" });
    setCreateDialogOpen(false);
    setNewName(""); setNewEmail(""); setNewPassword(""); setNewMemberRole("");
    loadTeam();
  };

  const handleChangePassword = async () => {
    if (!passwordUserId || !resetPassword) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-team-member", {
        body: { action: "update-password", user_id: passwordUserId, new_password: resetPassword },
      });
      setLoading(false);

      if (error) {
        // Parse error body if available
        let errorMsg = error.message;
        try {
          const parsed = JSON.parse(error.context?.body || "{}");
          errorMsg = parsed.error || errorMsg;
        } catch {}
        toast({ title: "Erro", description: errorMsg, variant: "destructive" });
        return;
      }
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Senha alterada com sucesso!" });
      setPasswordDialogOpen(false);
      setResetPassword(""); setPasswordUserId("");
    } catch (e: any) {
      setLoading(false);
      toast({ title: "Erro", description: e.message || "Erro desconhecido", variant: "destructive" });
    }
  };

  const openPasswordDialog = (uid: string, name: string | null) => {
    setPasswordUserId(uid);
    setPasswordUserName(name || "Usuário");
    setResetPassword("");
    setShowResetPassword(false);
    setPasswordDialogOpen(true);
  };

  const openEditDialog = (member: TeamMember) => {
    setEditUserId(member.user_id);
    setEditUserName(member.full_name || "");
    setEditUserEmail(member.email || "");
    setEditRoles([...member.roles]);
    setEditDialogOpen(true);
  };

  const toggleEditRole = (role: string) => {
    setEditRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  };

  const handleSaveEdit = async () => {
    if (!editUserId) return;
    setLoading(true);

    // Update name via profiles
    await supabase.from("profiles").update({ full_name: editUserName }).eq("user_id", editUserId);

    // Update email via edge function (skip if user not found in auth)
    if (editUserEmail) {
      const { data: emailData } = await supabase.functions.invoke("manage-team-member", {
        body: { action: "update-email", user_id: editUserId, email: editUserEmail },
      });
      if (emailData?.error && !emailData.error.includes("not found")) {
        toast({ title: "Erro ao atualizar email", description: emailData.error, variant: "destructive" });
      }
    }

    // Update roles
    const { data: currentRoles } = await supabase.from("user_roles").select("id, role").eq("user_id", editUserId);
    const currentRoleNames = currentRoles?.map((r) => r.role as string) || [];
    const rolesToAdd = editRoles.filter((r) => !currentRoleNames.includes(r));
    const rolesToRemove = currentRoles?.filter((r) => !editRoles.includes(r.role as string)) || [];

    for (const roleToRemove of rolesToRemove) {
      await supabase.from("user_roles").delete().eq("id", roleToRemove.id);
    }
    for (const roleToAdd of rolesToAdd) {
      await supabase.from("user_roles").insert({ user_id: editUserId, role: roleToAdd as Role });
    }
    setLoading(false);
    toast({ title: "Membro atualizado!" });
    setEditDialogOpen(false);
    loadTeam();
  };

  const handleTogglePermission = async (role: string, module: string) => {
    const current = isEnabled(role, module);
    const error = await togglePermission(role, module, !current);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const roleColors: Record<string, string> = {
    admin: "bg-primary/20 text-primary",
    coordinator: "bg-warning/20 text-warning",
    trainer: "bg-success/20 text-success",
    master: "bg-accent/20 text-accent-foreground",
  };

  const roleLabels: Record<string, string> = {
    admin: "Admin",
    coordinator: "Coordenador",
    trainer: "Treinador",
    master: "Master",
  };

  // Get last 3 months for performance display
  const now = new Date();
  const performanceMonths = [0, 1, 2].map((i) => {
    const d = subMonths(now, i);
    return { key: format(d, "yyyy-MM"), label: format(d, "MMM/yy", { locale: ptBR }) };
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl text-primary">EQUIPE</h1>
            <p className="text-muted-foreground font-sans">Gerencie membros e permissões da equipe</p>
          </div>
        </div>

        <Tabs defaultValue="team" className="w-full" onValueChange={(v) => { if (v === "performance") loadPerformance(); }}>
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="team">Equipe</TabsTrigger>
            <TabsTrigger value="permissions">Permissões</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* ====== TAB: Equipe ====== */}
          <TabsContent value="team">
            <div className="space-y-4">
              <div className="flex gap-2 justify-end">
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setNewName(""); setNewEmail(""); setNewPassword(""); setNewMemberRole(""); setShowPassword(false); }}>
                      <Plus className="h-4 w-4 mr-2" />Novo Membro
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="text-primary">NOVO MEMBRO</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="font-sans">Nome completo</Label>
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do membro" className="bg-secondary border-border" />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-sans">Email</Label>
                        <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" className="bg-secondary border-border" />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-sans">Senha</Label>
                        <div className="relative">
                          <Input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="bg-secondary border-border pr-10" />
                          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-sans">Papel</Label>
                        <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                          <SelectTrigger className="bg-secondary border-border">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="coordinator">Coordenador</SelectItem>
                            <SelectItem value="trainer">Treinador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleCreateMember} className="w-full" disabled={loading || !newName || !newEmail || !newPassword || !newMemberRole}>
                        {loading ? "Criando..." : "Criar Membro"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" onClick={() => { setUserId(""); setNewRole(""); }}>
                      <UserPlus className="h-4 w-4 mr-2" />Atribuir Papel
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="text-primary">ATRIBUIR PAPEL</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="font-sans">Usuário</Label>
                        <Select value={userId} onValueChange={setUserId}>
                          <SelectTrigger className="bg-secondary border-border">
                            <SelectValue placeholder="Selecione um usuário" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableUsers.map((u) => (
                              <SelectItem key={u.user_id} value={u.user_id}>
                                {u.full_name || u.user_id.slice(0, 8) + "..."}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-sans">Papel</Label>
                        <Select value={newRole} onValueChange={setNewRole}>
                          <SelectTrigger className="bg-secondary border-border">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="coordinator">Coordenador</SelectItem>
                            <SelectItem value="trainer">Treinador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleAddRole} className="w-full">Atribuir</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Change Password Dialog */}
              <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-primary">ALTERAR SENHA</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground font-sans">Alterar senha de: <strong className="text-foreground">{passwordUserName}</strong></p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="font-sans">Nova senha</Label>
                      <div className="relative">
                        <Input type={showResetPassword ? "text" : "password"} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="bg-secondary border-border pr-10" />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowResetPassword(!showResetPassword)}>
                          {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button onClick={handleChangePassword} className="w-full" disabled={loading || resetPassword.length < 6}>
                      {loading ? "Alterando..." : "Alterar Senha"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Member Dialog */}
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-primary">EDITAR MEMBRO</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="font-sans">Nome completo</Label>
                      <Input value={editUserName} onChange={(e) => setEditUserName(e.target.value)} placeholder="Nome do membro" className="bg-secondary border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-sans">Email</Label>
                      <Input type="email" value={editUserEmail} onChange={(e) => setEditUserEmail(e.target.value)} placeholder="email@exemplo.com" className="bg-secondary border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-sans">Papéis</Label>
                      <div className="space-y-3">
                        {ALL_ROLES.map((role) => (
                          <div key={role} className="flex items-center space-x-3">
                            <Checkbox
                              id={`role-${role}`}
                              checked={editRoles.includes(role)}
                              onCheckedChange={() => toggleEditRole(role)}
                            />
                            <label htmlFor={`role-${role}`} className="text-sm font-sans font-medium leading-none cursor-pointer">
                              {roleLabels[role]}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button onClick={handleSaveEdit} className="w-full" disabled={loading || editRoles.length === 0}>
                      {loading ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="space-y-3">
                {members.map((m) => (
                  <Card key={m.user_id} className="bg-card border-border">
                    <CardContent className="flex items-center justify-between pt-6">
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                        <div>
                        <p className="text-foreground font-sans font-medium">{m.full_name}</p>
                          {m.email && <p className="text-muted-foreground text-xs font-sans">{m.email}</p>}
                          {!m.email && <p className="text-muted-foreground text-xs font-sans">{m.user_id.slice(0, 8)}...</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.roles.map((role) => (
                          <span key={role} className={`text-xs font-sans font-medium px-2 py-1 rounded capitalize ${roleColors[role] || ""}`}>
                            {roleLabels[role] || role}
                          </span>
                        ))}
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(m)} className="text-muted-foreground hover:text-foreground">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openPasswordDialog(m.user_id, m.full_name)} className="text-muted-foreground hover:text-foreground">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveRole(m.user_id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {members.length === 0 && (
                  <p className="text-muted-foreground font-sans text-center py-12">Nenhum membro na equipe</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ====== TAB: Permissões ====== */}
          <TabsContent value="permissions">
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground font-sans mb-6">
                  Defina quais módulos cada função pode acessar. Admins sempre têm acesso total.
                </p>
                {permLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-2 font-sans font-medium text-muted-foreground">Módulo</th>
                          {PERMISSION_ROLES.map((r) => (
                            <th key={r.key} className="text-center py-3 px-4 font-sans font-medium text-muted-foreground">{r.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PERMISSION_MODULES.map((mod) => (
                          <tr key={mod.key} className="border-b border-border/50">
                            <td className="py-3 px-2 font-sans text-foreground">{mod.label}</td>
                            {PERMISSION_ROLES.map((r) => (
                              <td key={r.key} className="text-center py-3 px-4">
                                <Switch
                                  checked={isEnabled(r.key, mod.key)}
                                  onCheckedChange={() => handleTogglePermission(r.key, mod.key)}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== TAB: Performance ====== */}
          <TabsContent value="performance">
            <div className="space-y-4">
              {perfLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : trainerPerformance.length === 0 ? (
                <p className="text-muted-foreground font-sans text-center py-12">Nenhum membro encontrado nesta empresa</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {trainerPerformance.map((t) => (
                    <Card key={t.user_id} className="bg-card border-border">
                       <CardHeader className="pb-3">
                         <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <CardTitle className="text-base font-sans flex items-center gap-2">
                               <Users className="h-4 w-4 text-muted-foreground" />
                               {t.full_name}
                             </CardTitle>
                             <span className={`text-xs font-sans font-medium px-2 py-0.5 rounded capitalize ${roleColors[t.role] || ""}`}>
                               {roleLabels[t.role] || t.role}
                             </span>
                           </div>
                           <Badge variant="secondary" className="gap-1">
                             <Users className="h-3 w-3" />
                             {t.activeStudents} {t.activeStudents === 1 ? "aluno" : "alunos"}
                           </Badge>
                         </div>
                       </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground font-sans mb-2 flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" /> Prescrições por mês
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {performanceMonths.map((m) => (
                            <div key={m.key} className="text-center p-2 rounded-md bg-secondary/50">
                              <p className="text-xs text-muted-foreground font-sans capitalize">{m.label}</p>
                              <p className="text-lg font-bold text-foreground">{t.workoutsByMonth[m.key] || 0}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
