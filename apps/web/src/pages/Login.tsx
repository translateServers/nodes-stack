import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCaptcha, useLogin } from '@/api';
import { InlineAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
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

  const handleSubmit = async (event: { preventDefault: () => void }) => {
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
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-105">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-3xl font-bold">Nebula</CardTitle>
          <CardDescription>管理后台登录</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <div className="space-y-2">
              <label htmlFor="account" className="text-sm font-medium">
                账号
              </label>
              <Input
                id="account"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                密码
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="captchaCode" className="text-sm font-medium">
                验证码
              </label>
              <Input
                id="captchaCode"
                value={captchaCode}
                onChange={(event) => setCaptchaCode(event.target.value)}
                required
              />
            </div>
            {captchaQuery.isLoading ? (
              <div className="flex justify-center py-2">
                <Spinner />
              </div>
            ) : captchaQuery.error ? (
              <InlineAlert variant="destructive">验证码加载失败</InlineAlert>
            ) : (
              <div
                className="border-border flex justify-center rounded-lg border p-3"
                dangerouslySetInnerHTML={captchaMarkup}
              />
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void captchaQuery.refetch()}
            >
              刷新验证码
            </Button>
            <Button type="submit" size="lg" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
