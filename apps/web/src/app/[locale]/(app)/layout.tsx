import Sidebar from '@/components/layout/Sidebar';
import PlayerBar from '@/components/layout/PlayerBar';

// Persistent shell for all authenticated app routes.
// Sidebar + main content area + fixed PlayerBar at the bottom.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      {/* Main area: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-24">{children}</main>
      </div>

      {/* Fixed player bar at the bottom */}
      <PlayerBar />
    </div>
  );
}
