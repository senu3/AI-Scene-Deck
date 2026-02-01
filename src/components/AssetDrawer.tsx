import { useCallback, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import AssetPanel from './AssetPanel';
import './AssetDrawer.css';

export default function AssetDrawer() {
  const {
    assetDrawerOpen,
    closeAssetDrawer,
    toggleAssetDrawer,
    closeDetailsPanel,
  } = useStore();

  const [isDragging, setIsDragging] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer when dragging out of it
  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!isDragging) return;
      if (!drawerRef.current) return;

      // Check if we're leaving the drawer area
      const rect = drawerRef.current.getBoundingClientRect();
      const { clientX, clientY } = e;

      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        closeAssetDrawer();
      }
    },
    [isDragging, closeAssetDrawer]
  );

  // Track drag state from AssetPanel
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    closeDetailsPanel();
  }, [closeDetailsPanel]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <>
      {/* Edge trigger button - visible when drawer is closed */}
      {!assetDrawerOpen && (
        <button
          className="drawer-edge-trigger"
          onClick={toggleAssetDrawer}
          title="Open Assets (Tab)"
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* Main drawer */}
      <div
        ref={drawerRef}
        className={`asset-drawer ${assetDrawerOpen ? 'open' : ''}`}
        onDragLeave={handleDragLeave}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {assetDrawerOpen && (
          <AssetPanel
            mode="drawer"
            onClose={closeAssetDrawer}
            enableContextMenu={true}
            enableDragDrop={true}
          />
        )}
      </div>

      {/* Backdrop for closing */}
      {assetDrawerOpen && (
        <div className="drawer-backdrop" onClick={closeAssetDrawer} />
      )}
    </>
  );
}
