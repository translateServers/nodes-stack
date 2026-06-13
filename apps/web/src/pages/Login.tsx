import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCaptcha, useLogin } from '@/api';
import { useAuthStore } from '@/store/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const captchaQuery = useCaptcha();
  const loginMutation = useLogin();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');

  useEffect(() => {
    if (useAuthStore.getState().accessToken) {
      void navigate('/', { replace: true });
    }
  }, [navigate]);

  const captchaMarkup = useMemo(
    () => ({ __html: captchaQuery.data?.captchaImage ?? '' }),
    [captchaQuery.data?.captchaImage],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!captchaQuery.data?.captchaId) {
      return;
    }

    await loginMutation.mutateAsync({
      account,
      password,
      captchaId: captchaQuery.data.captchaId,
      captchaCode,
    });
    void navigate('/', { replace: true });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'grey.100',
      }}
    >
      <Card sx={{ maxWidth: 420, width: '100%', mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
            Nebula
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 4 }}>
            管理后台登录
          </Typography>
          <Box
            component="form"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <Stack spacing={2}>
              <TextField
                label="账号"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                fullWidth
                required
              />
              <TextField
                label="密码"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                fullWidth
                required
              />
              <TextField
                label="验证码"
                value={captchaCode}
                onChange={(event) => setCaptchaCode(event.target.value)}
                fullWidth
                required
              />
              {captchaQuery.isLoading ? (
                <CircularProgress size={24} />
              ) : captchaQuery.error ? (
                <Alert severity="error">验证码加载失败</Alert>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1,
                  }}
                  dangerouslySetInnerHTML={captchaMarkup}
                />
              )}
              <Button type="button" variant="text" onClick={() => void captchaQuery.refetch()}>
                刷新验证码
              </Button>
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? '登录中...' : '登录'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
