import Typography from '@mui/material/Typography';
import { createBrowserRouter } from 'react-router';
import RequireAuth from '@/components/RequireAuth';
import MainLayout from '@/layouts/MainLayout';
import DashboardPage from '@/pages/Dashboard';
import LoginPage from '@/pages/Login';
import UsersPage from '@/pages/Users';

function ComingSoonPage() {
  return <Typography variant="h5">该功能未上线</Typography>;
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <MainLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: 'users',
            element: <UsersPage />,
          },
          {
            path: 'menus',
            element: <ComingSoonPage />,
          },
          {
            path: 'roles',
            element: <ComingSoonPage />,
          },
          {
            path: 'dict',
            element: <ComingSoonPage />,
          },
        ],
      },
    ],
  },
]);

export default router;
