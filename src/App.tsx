import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Builders } from './pages/Builders';
import { Developments } from './pages/Developments';
import { Login } from './pages/Login';
import { RegisterBuilder } from './pages/RegisterBuilder';
import { PropertyDetails } from './pages/PropertyDetails';
import { NewDevelopment } from './pages/NewDevelopment';
import { Consultancy } from './pages/Consultancy';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register-public" element={<RegisterBuilder />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/developments" element={<Developments />} />
            <Route path="/developments/new" element={<NewDevelopment />} />
            <Route path="/developments/edit/:id" element={<NewDevelopment />} />
            <Route path="/developments/:id" element={<PropertyDetails />} />
            <Route path="/builders" element={<Builders />} />
            <Route path="/builders/new" element={<RegisterBuilder />} />
            <Route path="/builders/edit/:id" element={<RegisterBuilder />} />
            <Route path="/consultancy" element={<Consultancy />} />
            <Route path="/analytics" element={<div className="p-8">Analytics Page (Coming Soon)</div>} />
            <Route path="/settings" element={<div className="p-8">Settings Page (Coming Soon)</div>} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
