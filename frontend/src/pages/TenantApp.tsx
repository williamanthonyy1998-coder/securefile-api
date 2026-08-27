import { Navigate, useParams } from "react-router-dom";

export default function TenantApp() {
  const { slug } = useParams<{ slug: string }>();

  const tenantSlug = slug?.trim().toLowerCase();

  if (!tenantSlug) {
    return <Navigate to="/login" replace />;
  }

  // Persist the tenant for the entire session.
  localStorage.setItem("securefile_tenant", tenantSlug);

  return <Navigate to="/login" replace />;
}