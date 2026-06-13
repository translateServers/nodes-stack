import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useUsers } from '@/api';

export default function UsersPage() {
  const { data, isLoading, error } = useUsers();

  if (isLoading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Alert severity="error">加载用户列表失败</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">用户管理</Typography>
      {data?.map((user) => (
        <Paper key={user.id} sx={{ p: 2 }}>
          <Typography variant="h6">{user.username}</Typography>
          <Typography color="text.secondary">{user.email}</Typography>
          <Typography variant="body2">状态：{user.isActive ? '启用' : '禁用'}</Typography>
        </Paper>
      ))}
    </Stack>
  );
}
