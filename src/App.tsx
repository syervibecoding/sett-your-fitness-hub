import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { MasterProvider } from "@/contexts/MasterContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FeatureRoute } from "@/components/FeatureRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Lazy load all pages
const Auth = lazy(() => import("./pages/Auth"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const PlansManager = lazy(() => import("./pages/admin/PlansManager"));
const TeamManager = lazy(() => import("./pages/admin/TeamManager"));
const StudentsManager = lazy(() => import("./pages/admin/StudentsManager"));
const StudentDetail = lazy(() => import("./pages/admin/StudentDetail"));
const RegistrationManager = lazy(() => import("./pages/admin/RegistrationManager"));
const AnamnesisManager = lazy(() => import("./pages/admin/AnamnesisManager"));
const AdminAgenda = lazy(() => import("./pages/admin/AdminAgenda"));
const FinancialDashboard = lazy(() => import("./pages/admin/FinancialDashboard"));
const WhatsAppSettings = lazy(() => import("./pages/admin/WhatsAppSettings"));
const WhatsAppChat = lazy(() => import("./pages/admin/WhatsAppChat"));
const WhatsAppCRM = lazy(() => import("./pages/admin/WhatsAppCRM"));
const WhatsAppAutomation = lazy(() => import("./pages/admin/WhatsAppAutomation"));
const WhatsAppTemplates = lazy(() => import("./pages/admin/WhatsAppTemplates"));
const AppearanceSettings = lazy(() => import("./pages/admin/AppearanceSettings"));
const ExerciseLibrary = lazy(() => import("./pages/admin/ExerciseLibrary"));
const WorkoutBuilder = lazy(() => import("./pages/admin/WorkoutBuilder"));
const WorkoutPrescriptions = lazy(() => import("./pages/admin/WorkoutPrescriptions"));
const CoordinatorDashboard = lazy(() => import("./pages/coordinator/CoordinatorDashboard"));
const TrainerDashboard = lazy(() => import("./pages/trainer/TrainerDashboard"));
const MasterDashboard = lazy(() => import("./pages/master/MasterDashboard"));
const CompaniesManager = lazy(() => import("./pages/master/CompaniesManager"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicRegistration = lazy(() => import("./pages/PublicRegistration"));
const PublicAnamnesis = lazy(() => import("./pages/PublicAnamnesis"));
const PublicPayment = lazy(() => import("./pages/PublicPayment"));
const StudentWorkout = lazy(() => import("./pages/student/StudentWorkout"));
const StudentPortal = lazy(() => import("./pages/student/StudentPortal"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function RoleRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (role === "master") return <Navigate to="/master" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "coordinator") return <Navigate to="/coordinator" replace />;
  if (role === "trainer") return <Navigate to="/trainer" replace />;
  if (role === "student") return <Navigate to="/aluno" replace />;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h2 className="text-2xl text-primary">AGUARDANDO LIBERAÇÃO</h2>
        <p className="text-muted-foreground font-sans">Sua conta ainda não possui um papel atribuído.</p>
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
        <ThemeProvider>
        <MasterProvider>
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/inscricao/:slug" element={<PublicRegistration />} />
          <Route path="/cadastro/:slug" element={<PublicRegistration />} />
          <Route path="/inscricao" element={<PublicRegistration />} />
          <Route path="/cadastro" element={<PublicRegistration />} />
          <Route path="/anamnese/:studentId" element={<PublicAnamnesis />} />
          <Route path="/pagamento/:studentId" element={<PublicPayment />} />
          <Route path="/aluno/treino/:studentId" element={<StudentWorkout />} />
          <Route path="/aluno" element={<ProtectedRoute allowedRoles={["student"]}><StudentPortal /></ProtectedRoute>} />
          <Route path="/" element={<RoleRedirect />} />

          {/* Master Routes */}
          <Route path="/master" element={<ProtectedRoute allowedRoles={["master"]}><MasterDashboard /></ProtectedRoute>} />
          <Route path="/master/companies" element={<ProtectedRoute allowedRoles={["master"]}><CompaniesManager /></ProtectedRoute>} />
          <Route path="/master/exercises" element={<ProtectedRoute allowedRoles={["master"]}><ExerciseLibrary /></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasDashboard"><AdminDashboard /></FeatureRoute>} />
          <Route path="/admin/registration" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasRegistration"><RegistrationManager /></FeatureRoute>} />
          <Route path="/admin/anamnesis" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasAnamnesis"><AnamnesisManager /></FeatureRoute>} />
          <Route path="/admin/plans" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasPlans"><PlansManager /></FeatureRoute>} />
          <Route path="/admin/team" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasTeam"><TeamManager /></FeatureRoute>} />
          <Route path="/admin/students" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasStudents"><StudentsManager /></FeatureRoute>} />
          <Route path="/admin/students/:id" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasStudents"><StudentDetail /></FeatureRoute>} />
          <Route path="/admin/agenda" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasAgenda"><AdminAgenda /></FeatureRoute>} />
          <Route path="/admin/financial" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasFinancial"><FinancialDashboard /></FeatureRoute>} />
          <Route path="/admin/whatsapp" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasWhatsApp"><WhatsAppSettings /></FeatureRoute>} />
          <Route path="/admin/whatsapp-chat" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasWhatsApp"><WhatsAppChat /></FeatureRoute>} />
          <Route path="/admin/whatsapp-crm" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasWhatsApp"><WhatsAppCRM /></FeatureRoute>} />
          <Route path="/admin/whatsapp-automation" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasAutomation"><WhatsAppAutomation /></FeatureRoute>} />
          <Route path="/admin/whatsapp-templates" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasWhatsApp"><WhatsAppTemplates /></FeatureRoute>} />
          <Route path="/admin/appearance" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasAppearance"><AppearanceSettings /></FeatureRoute>} />
          <Route path="/admin/exercises" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasPrescription"><ExerciseLibrary /></FeatureRoute>} />
          <Route path="/admin/prescriptions" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasPrescription"><WorkoutPrescriptions /></FeatureRoute>} />
          <Route path="/admin/workout/:cycleId" element={<FeatureRoute allowedRoles={["admin"]} requiredFeature="hasPrescription"><WorkoutBuilder /></FeatureRoute>} />

          {/* Coordinator Routes */}
          <Route path="/coordinator" element={<FeatureRoute allowedRoles={["coordinator"]} requiredFeature="hasDashboard"><CoordinatorDashboard /></FeatureRoute>} />
          <Route path="/coordinator/students" element={<FeatureRoute allowedRoles={["coordinator"]} requiredFeature="hasStudents"><StudentsManager /></FeatureRoute>} />
          <Route path="/coordinator/students/:id" element={<FeatureRoute allowedRoles={["coordinator"]} requiredFeature="hasStudents"><StudentDetail /></FeatureRoute>} />
          <Route path="/coordinator/exercises" element={<FeatureRoute allowedRoles={["coordinator"]} requiredFeature="hasPrescription"><ExerciseLibrary /></FeatureRoute>} />
          <Route path="/coordinator/prescriptions" element={<FeatureRoute allowedRoles={["coordinator"]} requiredFeature="hasPrescription"><WorkoutPrescriptions /></FeatureRoute>} />

          {/* Trainer Routes */}
          <Route path="/trainer" element={<FeatureRoute allowedRoles={["trainer"]} requiredFeature="hasDashboard"><TrainerDashboard /></FeatureRoute>} />
          <Route path="/trainer/students" element={<FeatureRoute allowedRoles={["trainer"]} requiredFeature="hasStudents"><StudentsManager /></FeatureRoute>} />
          <Route path="/trainer/students/:id" element={<FeatureRoute allowedRoles={["trainer"]} requiredFeature="hasStudents"><StudentDetail /></FeatureRoute>} />
          <Route path="/trainer/exercises" element={<FeatureRoute allowedRoles={["trainer"]} requiredFeature="hasPrescription"><ExerciseLibrary /></FeatureRoute>} />
          <Route path="/trainer/prescriptions" element={<FeatureRoute allowedRoles={["trainer"]} requiredFeature="hasPrescription"><WorkoutPrescriptions /></FeatureRoute>} />
          <Route path="/trainer/workout/:cycleId" element={<FeatureRoute allowedRoles={["trainer"]} requiredFeature="hasPrescription"><WorkoutBuilder /></FeatureRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
        </MasterProvider>
        </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
