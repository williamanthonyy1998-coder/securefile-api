import {
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";

import Layout from "./components/Layout";

import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Files from "./pages/Files";
import Users from "./pages/Users";
import Chat from "./pages/Chat";
import SuperAdmin from "./pages/SuperAdmin";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AcceptInvitation from "./pages/AcceptInvitation";
import PaymentPending from "./pages/PaymentPending";
import PaymentSuccess from "./pages/PaymentSuccess";
import CheckoutPreview from "./pages/CheckoutPreview";
import PublicShare from "./pages/PublicShare";
import FileViewer from "./pages/FileViewer";
import TenantApp from "./pages/TenantApp";
import Shared from "./pages/Shared";
import Requests from "./pages/Requests";
import Approvals from "./pages/Approvals";
import TaskManagement from "./pages/TaskManagement";
import Trash from "./pages/Trash";
import ScanDocuments from "./pages/ScanDocuments";
import FaxDocuments from "./pages/FaxDocuments";
import AiChat from "./pages/AiChat";
import Settings from "./pages/Settings";

function Private({ children }: { children: any }) {
  const t = localStorage.getItem("sf_token");

  if (!t) {
    return <Navigate to="/login" replace />;
  }

  if (localStorage.getItem("sf_role") === "SUPER_ADMIN") {
    return <Navigate to="/super-admin" replace />;
  }

  return <Layout>{children}</Layout>;
}

function SuperPrivate({ children }: { children: any }) {
  return localStorage.getItem("sf_token") &&
    localStorage.getItem("sf_role") === "SUPER_ADMIN"
    ? children
    : <Navigate to="/login" replace />;
}

const MODULE_REDIRECTS: Record<string, string> = {
  shared: "/shared",
  requests: "/requests",
  approvals: "/approvals",
  "task-management": "/task-management",
  trash: "/trash",
  "scan-documents": "/scan-documents",
  "fax-documents": "/fax-documents",
  ai: "/ai",
  settings: "/settings",
  chat: "/chat",
};

function ModuleRedirect() {
  const { name = "" } = useParams();
  const to = MODULE_REDIRECTS[name] || "/dashboard";
  return <Navigate to={to} replace />;
}

export default function App() {
  return (
    <Routes>

      {/* Public website */}
      <Route path="/" element={<Home />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/signup" element={<Signup />} />

      {/* Tenant entry */}
      <Route
        path="/t/:slug"
        element={<TenantApp />}
      />

      {/* Authentication */}
      <Route path="/login" element={<Login />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Invitations */}
      <Route
        path="/accept-invitation"
        element={<AcceptInvitation />}
      />

      {/* Payments */}
      <Route
        path="/payment/pending"
        element={<PaymentPending />}
      />

      <Route
        path="/payment/success"
        element={<PaymentSuccess />}
      />

      <Route
        path="/payment/cancel"
        element={<PaymentPending />}
      />

      <Route
        path="/checkout-preview"
        element={<CheckoutPreview />}
      />

      {/* Public file sharing */}
      <Route
        path="/public-share/:token"
        element={<PublicShare />}
      />

      {/* Super Admin */}
      <Route
        path="/super-admin"
        element={
          <SuperPrivate>
            <Layout>
              <SuperAdmin />
            </Layout>
          </SuperPrivate>
        }
      />

      {/* Tenant application */}
      <Route
        path="/dashboard"
        element={
          <Private>
            <Dashboard />
          </Private>
        }
      />

      <Route
        path="/files"
        element={
          <Private>
            <Files />
          </Private>
        }
      />

      <Route
        path="/files/:id/view"
        element={
          <Private>
            <FileViewer />
          </Private>
        }
      />

      <Route
        path="/users"
        element={
          <Private>
            <Users />
          </Private>
        }
      />

      <Route
        path="/chat/:conversationId"
        element={
          <Private>
            <Chat />
          </Private>
        }
      />

      <Route
        path="/chat"
        element={
          <Private>
            <Chat />
          </Private>
        }
      />

      <Route
        path="/shared"
        element={
          <Private>
            <Shared />
          </Private>
        }
      />

      <Route
        path="/requests"
        element={
          <Private>
            <Requests />
          </Private>
        }
      />

      <Route
        path="/approvals"
        element={
          <Private>
            <Approvals />
          </Private>
        }
      />

      <Route
        path="/task-management"
        element={
          <Private>
            <TaskManagement />
          </Private>
        }
      />

      <Route
        path="/trash"
        element={
          <Private>
            <Trash />
          </Private>
        }
      />

      <Route
        path="/scan-documents"
        element={
          <Private>
            <ScanDocuments />
          </Private>
        }
      />

      <Route
        path="/fax-documents"
        element={
          <Private>
            <FaxDocuments />
          </Private>
        }
      />

      <Route
        path="/ai"
        element={
          <Private>
            <AiChat />
          </Private>
        }
      />

      <Route
        path="/settings"
        element={
          <Private>
            <Settings />
          </Private>
        }
      />

      {/* Legacy /module/:name redirects */}
      <Route
        path="/module/chat"
        element={<Navigate to="/chat" replace />}
      />

      <Route
        path="/module/:name"
        element={
          <Private>
            <ModuleRedirect />
          </Private>
        }
      />

      {/* Fallback */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />

    </Routes>
  );
}
