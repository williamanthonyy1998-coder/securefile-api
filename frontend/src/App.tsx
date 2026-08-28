import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Layout from "./components/Layout";

import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Files from "./pages/Files";
import Users from "./pages/Users";
import Module from "./pages/Module";
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
        path="/module/:name"
        element={
          <Private>
            <Module />
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