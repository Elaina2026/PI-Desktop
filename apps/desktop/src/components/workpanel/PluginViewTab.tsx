import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { pluginViewIcon } from "../../lib/plugin-view-icons";
import { IconPlug } from "../icons";
import { WorkTabEmpty } from "./WorkTabEmpty";

/**
 * A plugin-contributed work panel view (ADR 0104).
 *
 * The surface itself is a main-process `WebContentsView`, the same isolated
 * page a `ui.panel` window hosts; this component renders nothing into it. It
 * measures the placeholder rect and drives visibility. The view composites
 * above renderer content, so a panel-wide blocking overlay still hides it;
 * the body-level work-panel menu instead clips it below the menu while open
 * rather than exposing the panel background.
 */
export function PluginViewTab({
  pluginId,
  viewId,
  title,
  icon,
  blocked = false,
  occludedById,
  sessionId,
  location,
}: {
  pluginId: string;
  viewId: string;
  title: string;
  icon?: string;
  blocked?: boolean;
  occludedById?: string;
  sessionId?: string;
  location?: string;
}) {
  const { t } = useTranslation();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  // Create the view, and re-create it whenever the plugin's lifecycle changed
  // underneath us: a crash, a development reload, or a re-enable all destroy
  // the previous web contents while this tab stays open.
  useEffect(() => {
    let current = true;
    const open = () => {
      void api.pluginViewOpen(pluginId, viewId, { sessionId, location }).then(
        () => {
          if (current) setFailed(false);
        },
        () => {
          if (current) setFailed(true);
        },
      );
    };
    open();
    const off = api.onPluginChanged((event) => {
      if (event?.pluginId && event.pluginId !== pluginId) return;
      open();
    });
    return () => {
      current = false;
      off();
    };
  }, [pluginId, viewId, sessionId, location]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || failed) return;
    void api.pluginViewSetVisible(pluginId, viewId, !blocked, sessionId);
    return () => {
      void api.pluginViewSetVisible(pluginId, viewId, false);
    };
  }, [pluginId, viewId, blocked, failed, sessionId]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || failed) return;
    let frame = 0;
    const report = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = surface.getBoundingClientRect();
        const occludedBy = occludedById
          ? document.getElementById(occludedById)
          : null;
        const occludedBottom = occludedBy?.getBoundingClientRect().bottom;
        const top = Math.max(
          rect.y,
          Math.min(rect.bottom, occludedBottom ?? rect.y),
        );
        void api.pluginViewSetBounds({
          x: rect.x,
          y: top,
          width: rect.width,
          height: Math.max(0, rect.bottom - top),
        });
      });
    };
    const observer = new ResizeObserver(report);
    observer.observe(surface);
    const occludedBy = occludedById
      ? document.getElementById(occludedById)
      : null;
    if (occludedBy) observer.observe(occludedBy);
    window.addEventListener("resize", report);
    report();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", report);
      cancelAnimationFrame(frame);
    };
  }, [pluginId, viewId, occludedById, failed]);

  if (failed) {
    return (
      <div className="work-plugin-view">
        <WorkTabEmpty
          icon={pluginViewIcon(icon) ?? IconPlug}
          title={title}
          body={t("panel.pluginView.failed")}
        />
      </div>
    );
  }

  return (
    <div className="work-plugin-view">
      <div ref={surfaceRef} className="work-plugin-view-surface" />
    </div>
  );
}
