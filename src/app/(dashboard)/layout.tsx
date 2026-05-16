export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface pt-10 pb-16 px-4">
      <div className="mx-auto max-w-4xl w-full">{children}</div>
    </div>
  )
}
