import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';

export default function DashboardPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        仪表盘
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1">欢迎使用 Nebula 管理后台</Typography>
      </Paper>
    </Box>
  );
}
