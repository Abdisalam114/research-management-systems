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
import { AnalyticsDashboardPage } from "./pages/AnalyticsDashboard";
import { GrantsPage } from "./pages/Grants";
import { BudgetsPage } from "./pages/Budgets";
import { PublicationsPage } from "./pages/Publications";
import { RepositoryPage } from "./pages/Repository";
import { GroupsPage } from "./pages/Groups";
import { NotificationsPage } from "./pages/Notifications";
import { MessagesPage } from "./pages/Messages";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route element={<ProtectedRoute roles={["research_director"]} />}>
            <Route path="/analytics" element={<AnalyticsDashboardPage />} />
          </Route>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/messages" element={<MessagesPage />} />

          <Route element={<ProtectedRoute roles={["research_director"]} />}>
            <Route path="/pending-users" element={<PendingUsersPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={["researcher", "faculty_coordinator", "research_director"]} />}>
            <Route path="/proposals" element={<ProposalsListPage />} />
            <Route element={<ProtectedRoute roles={["researcher"]} />}>
              <Route path="/proposals/new" element={<ProposalFormPage />} />
            </Route>
            <Route path="/proposals/:id" element={<ProposalDetailsPage />} />
            <Route element={<ProtectedRoute roles={["faculty_coordinator", "research_director"]} />}>
              <Route path="/proposals/:id/review" element={<ProposalReviewPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={["researcher", "faculty_coordinator", "research_director"]} />}>
            <Route path="/projects" element={<ProjectsListPage />} />
            <Route path="/projects/:id" element={<ProjectDetailsPage />} />
            <Route element={<ProtectedRoute roles={["researcher"]} />}>
              <Route path="/projects/:id/progress" element={<ProjectProgressUpdatePage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={["researcher", "faculty_coordinator", "finance_officer", "research_director"]} />}>
            <Route path="/grants" element={<GrantsPage />} />
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/publications" element={<PublicationsPage />} />
            <Route path="/repository" element={<RepositoryPage />} />
            <Route path="/groups" element={<GroupsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
