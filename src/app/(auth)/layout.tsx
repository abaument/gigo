/**
 * Layout for authentication pages (login, signup).
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-espresso">
      {children}
    </div>
  );
}
