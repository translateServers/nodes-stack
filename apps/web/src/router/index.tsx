import { createBrowserRouter } from 'react-router';
import MainLayout from '@/layouts/MainLayout';
import DashboardPage from '@/pages/Dashboard';
import LoginPage from '@/pages/Login';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
    ],
  },
]);

export default router;
