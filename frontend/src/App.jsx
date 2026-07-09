import { NavLink, Route, Routes } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import NewExperimentPage from './pages/NewExperimentPage'
import ExperimentDetailPage from './pages/ExperimentDetailPage'
import ComparePage from './pages/ComparePage'

function App() {
  const navClassName = ({ isActive }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold">QForge</h1>
            <p className="text-sm text-gray-500">
              Quantum experiment workbench
            </p>
          </div>

          <nav className="flex items-center gap-2">
            <NavLink to="/" end className={navClassName}>
              Dashboard
            </NavLink>
            <NavLink to="/experiments/new" className={navClassName}>
              New Experiment
            </NavLink>
            <NavLink to="/compare" className={navClassName}>
              Compare
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/experiments/new" element={<NewExperimentPage />} />
          <Route path="/experiments/:id" element={<ExperimentDetailPage />} />
          <Route path="/compare" element={<ComparePage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App