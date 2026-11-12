import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { GlobalDashboard } from './screens/GlobalDashboard.js';
import { ProjectsDashboard } from './screens/ProjectsDashboard.js';
import { ProjectWorkspace } from './screens/ProjectWorkspace.js';
import { AIWorkspace } from './screens/AIWorkspace.js';
import { BuildCenter } from './screens/BuildCenter.js';
import { AuditCenter } from './screens/AuditCenter.js';
import { ReleaseCenter } from './screens/ReleaseCenter.js';
import { Settings } from './screens/Settings.js';

export function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<GlobalDashboard />} />
          <Route path="/projects" element={<ProjectsDashboard />} />
          <Route path="/projects/:slug" element={<ProjectWorkspace />} />
          <Route path="/ai" element={<AIWorkspace />} />
          <Route path="/builds" element={<BuildCenter />} />
          <Route path="/audit" element={<AuditCenter />} />
          <Route path="/releases" element={<ReleaseCenter />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
