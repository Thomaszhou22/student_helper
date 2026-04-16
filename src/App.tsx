import { Route, Routes } from "react-router-dom";
import { AdminDashboardPage } from "./admin/AdminDashboardPage";
import { AdminEmailPage } from "./admin/AdminEmailPage";
import { AdminStoragePage } from "./admin/AdminStoragePage";
import { AuthLoginPage } from "./auth/AuthLoginPage";
import { AuthSignupPage } from "./auth/AuthSignupPage";
import { DeadlineTrackerPage } from "./DeadlineTrackerPage";
import { GpaCalculatorPage } from "./GpaCalculatorPage";
import { StudentToolsHubLanding } from "./StudentToolsHubLanding";
import { PdfToolkitPage } from "./PdfToolkitPage";
import { StudyOrganizerPage } from "./StudyOrganizerPage";
import { StudyTimerPage } from "./StudyTimerPage";
import { TimezoneConverterPage } from "./TimezoneConverterPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StudentToolsHubLanding />} />
      <Route path="/auth/login" element={<AuthLoginPage />} />
      <Route path="/auth/signup" element={<AuthSignupPage />} />
      <Route path="/tools/gpa" element={<GpaCalculatorPage />} />
      <Route path="/tools/deadline" element={<DeadlineTrackerPage />} />
      <Route path="/tools/timezone" element={<TimezoneConverterPage />} />
      <Route path="/tools/pdf" element={<PdfToolkitPage />} />
      <Route path="/tools/timer" element={<StudyTimerPage />} />
      <Route path="/tools/organizer" element={<StudyOrganizerPage />} />
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/admin/storage" element={<AdminStoragePage />} />
      <Route path="/admin/email" element={<AdminEmailPage />} />
    </Routes>
  );
}
