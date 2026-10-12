import { WifiOff } from "lucide-react";
import { WheelMark } from "@/components/brand/WheelMark";

export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <WheelMark size={40} className="mx-auto" />
        <WifiOff className="mx-auto mt-6 h-8 w-8 text-muted" aria-hidden />
        <h1 className="mt-3 text-title-1 font-bold text-ink">You&apos;re offline</h1>
        <p className="mx-auto mt-2 max-w-xs text-body text-muted">Front Desk needs a connection for new answers. Your recent answers are saved in the app; reconnect and pull to refresh.</p>
      </div>
    </main>
  );
}
