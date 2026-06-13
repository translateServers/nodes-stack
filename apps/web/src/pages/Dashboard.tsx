import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useHealth, useProfile } from '@/api/hooks';

export default function DashboardPage() {
  const profileQuery = useProfile();
  const healthQuery = useHealth();

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" gutterBottom>
          仪表盘
        </Typography>
        <Typography color="text.secondary">
          欢迎回来，{profileQuery.data?.username ?? '管理员'}
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          服务状态
        </Typography>
        {healthQuery.isLoading ? (
          <CircularProgress size={24} />
        ) : healthQuery.error ? (
          <Alert severity="error">健康检查失败</Alert>
        ) : (
          <Stack spacing={1}>
            <Typography>状态：{healthQuery.data?.status}</Typography>
            <Typography>数据库：{healthQuery.data?.database}</Typography>
            <Typography>时间：{healthQuery.data?.timestamp}</Typography>
            <Typography>运行时长：{Math.round(healthQuery.data?.uptime ?? 0)}s</Typography>
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
