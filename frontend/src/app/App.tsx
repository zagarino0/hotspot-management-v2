import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "../pages/Login/Login";
import Dashboard from "../pages/Dashboard/Dashboard";
import Sites from "../pages/Sites/Sites";
import AddSite from "../pages/Sites/AddSite";
import Routers from "../pages/Routers/Routers";
import AddRouter from "../pages/Routers/AddRouter";
import AccessPoints from "../pages/AccessPoints/AccessPoints";
import AddAccessPoint from "../pages/AccessPoints/AddAccessPoint";
import Clients from "../pages/Clients/Clients";
import AddClient from "../pages/Clients/AddClient";
import Sessions from "../pages/Sessions/Sessions";
import Vouchers from "../pages/Vouchers/Vouchers";
import GenerateVouchers from "../pages/Vouchers/GenerateVouchers";
import Sales from "../pages/Billing/Sales";
import RecordSale from "../pages/Billing/RecordSale";
import Statistics from "../pages/Statistics/Statistics";
import Users from "../pages/Users/Users";
import AddUser from "../pages/Users/AddUser";
import Roles from "../pages/Roles/Roles";
import AddRole from "../pages/Roles/AddRole";
import Infrastructure from "../pages/Infrastructure/Infrastructure";
import Settings from "../pages/Settings/Settings";

import DashboardLayout from "../components/layout/DashboardLayout";
import ProtectedRoute from "../components/auth/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}