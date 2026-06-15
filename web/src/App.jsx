import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ResourceDetail from './pages/ResourceDetail';
import Upload from './pages/Upload';
import SearchResult from './pages/SearchResult';
import SkillsList from './pages/SkillsList';
import ExpertsList from './pages/ExpertsList';
import TypeBrowse from './pages/TypeBrowse';
import Profile from './pages/Profile';
import SyncPage from './pages/SyncPage';
import ScenesList from './pages/ScenesList';
import SceneDetail from './pages/SceneDetail';
import SceneCreate from './pages/SceneCreate';
import BundleDetail from './pages/BundleDetail';
import Login from './pages/Login';
import Leaderboard from './pages/Leaderboard';
import Layout from './components/Layout';

function App() {
  return (
    <Routes>
      {/* 登录页面（独立于 Layout，无需认证） */}
      <Route path="/login" element={<Login />} />

      {/* 需要认证的页面（包裹在 Layout 中） */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchResult />} />
        <Route path="/skills" element={<SkillsList />} />
        <Route path="/experts" element={<ExpertsList />} />
        <Route path="/scenes" element={<ScenesList />} />
        <Route path="/scenes/:id" element={<SceneDetail />} />
        <Route path="/scenes/create" element={<SceneCreate />} />
        <Route path="/type/:type" element={<TypeBrowse />} />
        <Route path="/resources/:id" element={<ResourceDetail />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/profile/:userId?" element={<Profile />} />
        <Route path="/sync/:sessionId" element={<SyncPage />} />
        <Route path="/bundles/:id" element={<BundleDetail />} />
      </Route>
    </Routes>
  );
}

export default App;
