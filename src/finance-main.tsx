import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FinancePage } from './pages/FinancePage'
import './index.css'

createRoot(document.getElementById('finance-root')!).render(
  <StrictMode>
    <FinancePage />
  </StrictMode>,
)