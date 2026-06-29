import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Builders } from './pages/Builders';
import { Developments } from './pages/Developments';
import { Login } from './pages/Login';
import { UpdatePassword } from './pages/UpdatePassword';
import { RegisterBuilder } from './pages/RegisterBuilder';
import { PropertyDetails } from './pages/PropertyDetails';
import { NewDevelopment } from './pages/NewDevelopment';
import { Lands } from './pages/Lands';
import { RegisterLand } from './pages/RegisterLand';
import { Consultancy } from './pages/Consultancy';
import { Clients } from './pages/Clients';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LotAnalyzer } from './pages/LotAnalyzer';

import { Branding } from './pages/Branding';
import { Showcase } from './pages/Showcase';
import { PropertyPublic } from './pages/PropertyPublic';

function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register-public" element={<RegisterBuilder />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/view/:id" element={<PropertyPublic />} />
        <Route path="/:userId" element={<Showcase />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/project-developments" element={<Developments />} />
            <Route path="/developments" element={<Developments />} />
            <Route path="/lands" element={<Lands />} />
            <Route path="/lands/new" element={<RegisterLand />} />
            <Route path="/lands/edit/:id" element={<RegisterLand />} />
            <Route path="/developments/new" element={<NewDevelopment />} />
            <Route path="/developments/:id" element={<PropertyDetails />} />
            <Route path="/developments/edit/:id" element={<NewDevelopment />} />
            <Route path="/lot-analyzer" element={<LotAnalyzer />} />
            
            {/* New Distinct Routes */}
            <Route path="/projects/:id" element={<PropertyDetails />} />
            <Route path="/projects/new" element={<NewDevelopment />} />
            <Route path="/projects/edit/:id" element={<NewDevelopment />} />
            
            <Route path="/units/:id" element={<PropertyDetails />} />
            <Route path="/units/new" element={<NewDevelopment />} />
            <Route path="/units/edit/:id" element={<NewDevelopment />} />
            
            <Route path="/builders" element={<Builders />} />
            <Route path="/builders/new" element={<RegisterBuilder />} />
            <Route path="/builders/edit/:id" element={<RegisterBuilder />} />
            <Route path="/consultancy" element={<Consultancy />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/analytics" element={<div className="p-8">Analytics Page (Coming Soon)</div>} />
            <Route path="/settings" element={<div className="p-8">Settings Page (Coming Soon)</div>} />
            <Route path="/settings/branding" element={<Branding />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
