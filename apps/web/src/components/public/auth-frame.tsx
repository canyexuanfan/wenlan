export function AuthFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main id="main-content" className="auth-page-shell">
      {children}
    </main>
  );
}
