import { useEffect, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { Moon, RefreshCw, ShieldCheck, Sparkles, Sun, UserRound } from 'lucide-react';
import { Controller } from 'react-hook-form';
import { useCaptcha, useLogin } from './hooks';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useNebulaForm } from '@/hooks/use-nebula-form';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';

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

/* ── Theme Toggle ─────────────────────────────────────── */
function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const toggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="切换主题"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

/* ── Login form schema ────────────────────────────────── */
const LoginFormSchema = z.object({
  account: z.string().min(1, '账号不能为空'),
  password: z.string().min(1, '密码不能为空'),
  captchaCode: z.string().min(1, '验证码不能为空'),
});

/* ── Login page ───────────────────────────────────────── */
export default function LoginPage() {
  const navigate = useNavigate();
  const captchaQuery = useCaptcha();
  const loginMutation = useLogin();

  const form = useNebulaForm({
    schema: LoginFormSchema,
    defaultValues: { account: '', password: '', captchaCode: '' },
  });

  useEffect(() => {
    if (useAuthStore.getState().accessToken) {
      void navigate({ to: '/', replace: true });
    }
  }, [navigate]);

  const captchaMarkup = useMemo(
    () => ({ __html: captchaQuery.data?.captchaImage ?? '' }),
    [captchaQuery.data?.captchaImage],
  );

  const onSubmit = form.handleSubmit(async (data) => {
    if (!captchaQuery.data?.captchaId) return;
    await loginMutation.mutateAsync({
      ...data,
      captchaId: captchaQuery.data.captchaId,
    });
    void navigate({ to: '/', replace: true });
  });

  return (
    <div className="flex min-h-screen">
      {/* ── Left: Brand Panel ── */}
      <BrandPanel />

      {/* ── Right: Form Panel ── */}
      <main className="relative flex flex-1 items-center justify-center bg-background px-4 py-8 lg:px-8">
        {/* Theme toggle */}
        <ThemeToggle />

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
            <form onSubmit={(e) => void onSubmit(e)}>
              <FieldGroup>
                {/* Account */}
                <Controller
                  name="account"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>账号</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="请输入账号"
                        autoComplete="username"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />

                {/* Password */}
                <Controller
                  name="password"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>密码</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        type="password"
                        placeholder="请输入密码"
                        autoComplete="current-password"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />

                {/* Captcha */}
                <Controller
                  name="captchaCode"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>验证码</FieldLabel>
                      <div className="flex items-center gap-2">
                        <Input
                          {...field}
                          id={field.name}
                          placeholder="请输入验证码"
                          autoComplete="off"
                          className="h-10 flex-1"
                          aria-invalid={fieldState.invalid}
                        />
                        {captchaQuery.isLoading ? (
                          <div className="flex h-10 items-center justify-center rounded-lg border border-border px-3">
                            <Spinner />
                          </div>
                        ) : captchaQuery.error ? (
                          <div className="flex h-10 items-center justify-center rounded-lg border border-destructive px-3 text-xs text-destructive">
                            加载失败
                          </div>
                        ) : (
                          <div
                            className="flex h-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border transition-colors hover:border-primary/40"
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
                      </div>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />

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
                  <Alert variant="destructive">登录失败，请检查账号、密码或验证码是否正确</Alert>
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
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
