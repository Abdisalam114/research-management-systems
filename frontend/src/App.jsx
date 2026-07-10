import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { AppLayout } from "./layout/AppLayout";
import { LoginPage } from "./pages/Login";
import { RegisterPage } from "./pages/Register";
import { DashboardPage } from "./pages/Dashboard";
import { PendingUsersPage } from "./pages/PendingUsers";
import { ProfilePage } from "./pages/Profile";
import { ProposalsListPage } from "./pages/ProposalsList";
import { ProposalFormPage } from "./pages/ProposalForm";
import { ProposalDetailsPage } from "./pages/ProposalDetails";
import { ProposalReviewPage } from "./pages/ProposalReview";
import { ProjectsListPage } from "./pages/ProjectsList";
import { ProjectDetailsPage } from "./pages/ProjectDetails";
import { ProjectProgressUpdatePage } from "./pages/ProjectProgressUpdate";
import { GrantsPage } from "./pages/Grants";
import { GrantDetailsPage } from "./pages/GrantDetails";
import { GrantApplyPage } from "./pages/GrantApplyPage";
import { BudgetsPage } from "./pages/Budgets";
import { PaymentDetailsPage } from "./pages/PaymentDetails";
import { PublicationsPage } from "./pages/Publications";
import { RepositoryPage } from "./pages/Repository";
import { GroupsPage } from "./pages/Groups";
import { NotificationsPage } from "./pages/Notifications";
import { MessagesPage } from "./pages/Messages";
import { CollaborationPage } from "./pages/Collaboration";
import { DepartmentsPage } from "./pages/Departments";
import { CoordinatorDashboardPage } from "./pages/CoordinatorDashboard";
import { EthicsPage } from "./pages/Ethics";
import { ThesisGroupsPage } from "./pages/ThesisGroups";
import { ResearchWorkflowPage } from "./pages/ResearchWorkflowPage";
import { FundingCallsPage } from "./pages/FundingCalls";
import { ReviewAssignmentsPage } from "./pages/ReviewAssignments";
import { ProgramTierSelectPage } from "./pages/ProgramTierSelect";
import { AuditTrailPage } from "./pages/AuditTrailPage";
import { FinanceReportsPage } from "./pages/FinanceReports";
import { DonorReportsPage } from "./pages/DonorReportsPage";
import { KpiDashboardPage } from "./pages/KpiDashboardPage";
import { GlobalSearchPage } from "./pages/GlobalSearchPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/program-tier" element={<ProgramTierSelectPage />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/analytics" element={<Navigate to="/dashboard#institutional-analytics" replace />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route element={<ProtectedRoute roles={["researcher", "faculty_coordinator", "research_director", "finance_officer", "hr_officer"]} />}>
            <Route path="/messages" element={<MessagesPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["researcher", "faculty_coordinator", "research_director", "finance_officer", "ethics_committee", "procurement_officer", "peer_reviewer", "hr_officer", "leadership", "donor_agency"]} />}>
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/collaboration" element={<CollaborationPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["research_director"]} />}>
            <Route path="/pending-users" element={<PendingUsersPage />} />
            <Route path="/departments" element={<DepartmentsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["faculty_coordinator"]} />}>
            <Route path="/faculty-dashboard" element={<CoordinatorDashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["research_director", "finance_officer", "donor_agency"]} />}>
            <Route path="/finance-reports" element={<FinanceReportsPage />} />
            <Route path="/donor-reports" element={<DonorReportsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["research_director", "faculty_coordinator"]} />}>
            <Route path="/audit-trail" element={<AuditTrailPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["research_director", "faculty_coordinator", "finance_officer", "leadership"]} />}>
            <Route path="/kpi-dashboard" element={<KpiDashboardPage />} />
          </Route>

          <Route path="/search" element={<GlobalSearchPage />} />

          <Route path="/payments" element={<Navigate to="/budgets" replace />} />
          <Route path="/procurement" element={<Navigate to="/budgets" replace />} />
          <Route path="/policies" element={<Navigate to="/dashboard" replace />} />

          <Route element={<ProtectedRoute roles={["researcher", "faculty_coordinator", "research_director"]} />}>
            <Route path="/proposals" element={<ProposalsListPage />} />
            <Route element={<ProtectedRoute roles={["researcher"]} />}>
              <Route path="/proposals/new" element={<ProposalFormPage />} />
              <Route path="/proposals/:id/edit" element={<ProposalFormPage />} />
            </Route>
            <Route path="/proposals/:id" element={<ProposalDetailsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["researcher", "faculty_coordinator", "research_director", "hr_officer"]} />}>
            <Route path="/projects" element={<ProjectsListPage />} />
            <Route path="/projects/:id" element={<ProjectDetailsPage />} />
            <Route element={<ProtectedRoute roles={["researcher"]} />}>
              <Route path="/projects/:id/progress" element={<ProjectProgressUpdatePage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={["researcher", "faculty_coordinator", "research_director", "hr_officer"]} />}>
            <Route path="/research-journey" element={<Navigate to="/projects" replace />} />
            <Route path="/publications" element={<PublicationsPage />} />
            <Route path="/research-workflow" element={<ResearchWorkflowPage />} />
            <Route path="/repository" element={<RepositoryPage />} />
            <Route path="/groups" element={<GroupsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["researcher", "faculty_coordinator", "research_director", "hr_officer"]} />}>
            <Route path="/thesis" element={<ThesisGroupsPage />} />
            <Route path="/thesis-groups" element={<Navigate to="/thesis" replace />} />
          </Route>

          <Route element={<ProtectedRoute roles={["researcher", "faculty_coordinator", "research_director", "finance_officer", "leadership", "procurement_officer", "donor_agency"]} />}>
            <Route element={<ProtectedRoute roles={["researcher"]} />}>
              <Route path="/grants/apply" element={<GrantApplyPage />} />
            </Route>
            <Route path="/grants" element={<GrantsPage />} />
            <Route path="/grants/:id" element={<GrantDetailsPage />} />
            <Route path="/funding-calls" element={<FundingCallsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["researcher", "faculty_coordinator", "research_director", "peer_reviewer"]} />}>
            <Route path="/review-assignments" element={<ReviewAssignmentsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["peer_reviewer", "faculty_coordinator", "research_director", "finance_officer"]} />}>
            <Route path="/proposals/:id/review" element={<ProposalReviewPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["researcher", "finance_officer", "research_director", "procurement_officer"]} />}>
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/payments/:id" element={<PaymentDetailsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["researcher", "faculty_coordinator", "research_director", "ethics_committee"]} />}>
            <Route path="/ethics" element={<EthicsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
