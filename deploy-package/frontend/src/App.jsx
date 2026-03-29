import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';

import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import Plans from './pages/plans/Plans';
import Classes from './pages/classes/Classes';
import ClassSchedule from './pages/classes/ClassSchedule';
import Clients from './pages/clients/Clients';
import ClientProfile from './pages/clients/ClientProfile';
import ClientAttendance from './pages/clients/ClientAttendance';
import ClientRenewals from './pages/clients/ClientRenewals';
import Invoices from './pages/sales/Invoices';
import ReceivedPayments from './pages/sales/ReceivedPayments';
import PendingPayments from './pages/sales/PendingPayments';
import StaffAttendance from './pages/staff/StaffAttendance';
import Users from './pages/staff/Users';
import Salary from './pages/staff/Salary';
import Expenses from './pages/expenses/Expenses';
import Reports from './pages/reports/Reports';
import Settings from './pages/settings/Settings';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="loading-wrap" style={{ height: '100vh' }}>
      <div className="spinner" />
      <span>Loading AcademyPRO...</span>
    </div>
  );
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index               element={<Dashboard />} />
            <Route path="plans"        element={<Plans />} />
            <Route path="classes"      element={<Classes />} />
            <Route path="classes/schedule" element={<ClassSchedule />} />
            <Route path="clients"      element={<Clients />} />
            <Route path="clients/:id"  element={<ClientProfile />} />
            <Route path="clients/attendance" element={<ClientAttendance />} />
            <Route path="clients/renewals"   element={<ClientRenewals />} />
            <Route path="sales/invoices" element={<Invoices />} />
            <Route path="sales/payments" element={<ReceivedPayments />} />
            <Route path="sales/pending"  element={<PendingPayments />} />
            <Route path="staff/attendance" element={<StaffAttendance />} />
            <Route path="staff/users"      element={<Users />} />
            <Route path="staff/salary"     element={<Salary />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="reports"  element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
