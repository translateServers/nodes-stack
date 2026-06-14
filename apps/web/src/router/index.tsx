import { createBrowserRouter } from 'react-router';
import RequireAuth from '@/components/RequireAuth';
import MainLayout from '@/layouts/MainLayout';
import DashboardPage from '@/pages/Dashboard';
import LoginPage from '@/pages/Login';
import UsersPage from '@/pages/Users';
import MenusPage from '@/pages/Menus';
import RolesPage from '@/pages/Roles';

function ComingSoonPage() {
  return <div className="text-xl font-semibold">该功能未上线</div>;
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
            element: <MenusPage />,
          },
          {
            path: 'roles',
            element: <RolesPage />,
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
