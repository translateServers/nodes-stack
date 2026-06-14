import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { RefreshCw, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useCaptcha, useLogin } from '@/api';
import { InlineAlert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/store/auth';

/* ── Decorative orbs for the brand panel ──────────────── */
function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-primary lg:flex lg:w-[45%]">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-br from-primary via-primary/90 to-indigo-400 dark:to-indigo-500" />

      {/* Floating orbs */}
      <div className="absolute top-[15%] left-[20%] h-64 w-64 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute right-[10%] bottom-[25%] h-48 w-48 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute top-[55%] left-[55%] h-32 w-32 rounded-full bg-white/10 blur-xl" />
      <div className="absolute top-[8%] right-[15%] h-20 w-20 rounded-full bg-white/15 blur-lg" />
      <div className="absolute bottom-[12%] left-[10%] h-24 w-24 rounded-full bg-white/8 blur-2xl" />

      {/* Brand content */}
      <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">Nebula</span>
        </div>

        <h1 className="mb-4 text-4xl font-bold leading-tight text-white xl:text-5xl">管理后台</h1>
        <p className="max-w-md text-lg leading-relaxed text-white/70">
          安全、高效地管理您的业务数据与系统配置
        </p>

        {/* Feature highlights */}
        <div className="mt-12 space-y-4">
          <div className="flex items-center gap-3 text-sm text-white/60">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>企业级安全防护与权限管理</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/60">
            <UserRound className="h-4 w-4 shrink-0" />
            <span>多角色协作与精细化访问控制</span>
          </div>
        </div>
      </div>

      {/* Bottom decoration */}
      <div className="absolute right-0 bottom-0 left-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />
    </aside>
  );
}

/* ── Login page ───────────────────────────────────────── */
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
    <div className="flex min-h-screen">
      {/* ── Left: Brand Panel ── */}
      <BrandPanel />

      {/* ── Right: Form Panel ── */}
      <main className="flex flex-1 items-center justify-center bg-background px-4 py-8 lg:px-8">
        <Card className="w-full max-w-md border-0 shadow-lg lg:shadow-xl">
          <CardHeader className="space-y-1 pb-8 text-center">
            {/* Mobile-only brand badge */}
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 lg:hidden">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">登录到 Nebula</CardTitle>
            <CardDescription>请输入您的账号信息以访问管理后台</CardDescription>
          </CardHeader>

          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                void handleSubmit(event);
              }}
            >
              {/* Account */}
              <div className="space-y-2">
                <label htmlFor="account" className="text-sm font-medium leading-none">
                  账号
                </label>
                <Input
                  id="account"
                  placeholder="请输入账号"
                  autoComplete="username"
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium leading-none">
                  密码
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              {/* Captcha */}
              <div className="space-y-2">
                <label htmlFor="captchaCode" className="text-sm font-medium leading-none">
                  验证码
                </label>
                <Input
                  id="captchaCode"
                  placeholder="请输入验证码"
                  autoComplete="off"
                  value={captchaCode}
                  onChange={(event) => setCaptchaCode(event.target.value)}
                  required
                />
              </div>

              {/* Captcha image */}
              {captchaQuery.isLoading ? (
                <div className="flex justify-center py-3">
                  <Spinner />
                </div>
              ) : captchaQuery.error ? (
                <InlineAlert variant="destructive">验证码加载失败</InlineAlert>
              ) : (
                <div
                  className="flex cursor-pointer justify-center rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
                  onClick={() => void captchaQuery.refetch()}
                  role="button"
                  tabIndex={0}
                  aria-label="点击刷新验证码"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      void captchaQuery.refetch();
                    }
                  }}
                  dangerouslySetInnerHTML={captchaMarkup}
                />
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mx-auto flex items-center gap-1.5 text-muted-foreground"
                onClick={() => void captchaQuery.refetch()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                刷新验证码
              </Button>

              {/* Error from login mutation */}
              {loginMutation.isError && (
                <InlineAlert variant="destructive">
                  登录失败，请检查账号、密码或验证码是否正确
                </InlineAlert>
              )}

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                className="h-11 w-full text-sm font-semibold"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? '登录中...' : '登录'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
