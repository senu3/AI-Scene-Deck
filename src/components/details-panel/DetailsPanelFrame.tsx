import type { ReactNode } from "react";
import { Settings } from "lucide-react";

interface DetailsPanelFrameProps {
  children: ReactNode;
}

export default function DetailsPanelFrame({ children }: DetailsPanelFrameProps) {
  return (
    <aside className="details-panel">
      <div className="details-header">
        <Settings size={18} />
        <span>DETAILS</span>
      </div>
      {children}
    </aside>
  );
}
