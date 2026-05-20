export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full min-w-0 overflow-x-hidden flex bg-surface">
      {children}
    </div>
  );
}
