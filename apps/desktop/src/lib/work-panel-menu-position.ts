/**
 * Placement for the work-panel resource switcher.
 *
 * The switcher is rendered at document.body level so it cannot participate in
 * the panel's header/body layout. These viewport coordinates keep the menu
 * anchored to the trigger while leaving the panel content flow untouched.
 */

export const WORK_PANEL_MENU_MARGIN = 8;
export const WORK_PANEL_MENU_GAP = 4;

export type WorkPanelMenuPlacement = {
  top: number;
  left: number;
};

export function placeWorkPanelMenu({
  trigger,
  menu,
  viewport,
  margin = WORK_PANEL_MENU_MARGIN,
  gap = WORK_PANEL_MENU_GAP,
}: {
  trigger: { left: number; top: number; bottom: number };
  menu: { width: number; height: number };
  viewport: { width: number; height: number };
  margin?: number;
  gap?: number;
}): WorkPanelMenuPlacement {
  const maxLeft = Math.max(margin, viewport.width - menu.width - margin);
  const left = Math.min(Math.max(margin, trigger.left), maxLeft);
  const below = trigger.bottom + gap;
  const above = trigger.top - menu.height - gap;
  const maxTop = Math.max(margin, viewport.height - menu.height - margin);
  const top =
    below <= maxTop
      ? Math.max(margin, below)
      : above >= margin
        ? above
        : Math.min(below, maxTop);

  return { top, left };
}
