import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "../components/auth/ProtectedRoute";

const Login = lazy(() => import("../pages/Login/Login"));
const Dashboard = lazy(() => import("../pages/Dashboard/Dashboard"));
const Sites = lazy(() => import("../pages/Sites/Sites"));
const AddSite = lazy(() => import("../pages/Sites/AddSite"));
const Routers = lazy(() => import("../pages/Routers/Routers"));
const AddRouter = lazy(() => import("../pages/Routers/AddRouter"));
const AccessPoints = lazy(
  () => import("../pages/AccessPoints/AccessPoints")
);
const AddAccessPoint = lazy(
  () => import("../pages/AccessPoints/AddAccessPoint")
);
const Clients = lazy(() => import("../pages/Clients/Clients"));
const AddClient = lazy(() => import("../pages/Clients/AddClient"));
const Sessions = lazy(() => import("../pages/Sessions/Sessions"));
const Vouchers = lazy(() => import("../pages/Vouchers/Vouchers"));
const GenerateVouchers = lazy(
  () => import("../pages/Vouchers/GenerateVouchers")
);
const Sales = lazy(() => import("../pages/Billing/Sales"));
const RecordSale = lazy(() => import("../pages/Billing/RecordSale"));
const Statistics = lazy(
  () => import("../pages/Statistics/Statistics")
);
const Users = lazy(() => import("../pages/Users/Users"));
const AddUser = lazy(() => import("../pages/Users/AddUser"));
const Roles = lazy(() => import("../pages/Roles/Roles"));
const AddRole = lazy(() => import("../pages/Roles/AddRole"));
const Infrastructure = lazy(
  () => import("../pages/Infrastructure/Infrastructure")
);
const Settings = lazy(() => import("../pages/Settings/Settings"));
const DashboardLayout = lazy(
  () => import("../components/layout/DashboardLayout")
);

function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
      Chargement…
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
        <Routes>

        {/* =====================================================
            PUBLIC
        ===================================================== */}

        <Route
          path="/login"
          element={<Login />}
        />

        {/* =====================================================
            PROTECTED
        ===================================================== */}

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>

              <Route
                path="/dashboard"
                element={<Dashboard />}
              />

              <Route
                path="/sites"
                element={<Sites />}
              />

              <Route
                path="/sites/new"
                element={<AddSite />}
              />
  
              <Route
                path="/routers"
                element={<Routers />}

              />

            <Route
                path="/routers/new"
                element={<AddRouter />}
              />

              <Route
                path="/access-points"
                element={<AccessPoints />}
              />

              <Route
                path="/access-points/new"
                element={<AddAccessPoint />}
              />

              <Route
                path="/clients"
                element={<Clients />}
              />

              <Route
                path="/clients/new"
                element={<AddClient />}
              />

              <Route
                path="/sessions"
                element={<Sessions />}
              />

              <Route
                path="/vouchers"
                element={<Vouchers />}
              />

              <Route
                path="/vouchers/new"
                element={<GenerateVouchers />}
              />

              <Route
                path="/billing/sales"
                element={<Sales />}
              />

              <Route
                path="/billing/sales/new"
                element={<RecordSale />}
              />

              <Route
                path="/statistics"
                element={<Statistics />}
              />

              <Route
                path="/users"
                element={<Users />}
              />

              <Route
                path="/users/new"
                element={<AddUser />}
              />

              <Route
                path="/roles"
                element={<Roles />}
              />

              <Route
                path="/roles/new"
                element={<AddRole />}
              />

              <Route
                  path="/infrastructure"
                  element={<Infrastructure />}
                />

                <Route
                  path="/settings"
                  element={<Settings />}
                />      

          </Route>
        </Route>

        {/* =====================================================
            FALLBACK
        ===================================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
