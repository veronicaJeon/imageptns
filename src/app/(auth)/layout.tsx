export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-primary/10 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="glass rounded-xl border border-outline-variant shadow-modal p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
