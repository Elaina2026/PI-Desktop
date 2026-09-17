import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/app-store";
import { IconClose, IconCopy, IconDownload } from "./icons";
import { TooltipButton } from "./ui";

export function ImageLightbox() {
  const { t } = useTranslation();
  const image = useAppStore((s) => s.lightboxImage);
  const close = useAppStore((s) => s.closeLightbox);
  const showToast = useAppStore((s) => s.showToast);

  const [scale, setScale] = useState(1);

  useEffect(() => {
    setScale(1);
  }, [image]);

  useEffect(() => {
    if (!image) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "+" || e.key === "=") setScale((s) => Math.min(4, s + 0.25));
      else if (e.key === "-") setScale((s) => Math.max(0.5, s - 0.25));
      else if (e.key === "0") setScale(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [image, close]);

  const copyImage = useCallback(async () => {
    if (!image?.src) return;
    try {
      if (image.src.startsWith("data:")) {
        const res = await fetch(image.src);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      } else {
        await navigator.clipboard.writeText(image.src);
      }
      showToast(t("chat.copied", "Copied to clipboard"), { variant: "success" });
    } catch {
      showToast("Failed to copy image", { variant: "error" });
    }
  }, [image, showToast, t]);

  const downloadImage = useCallback(() => {
    if (!image?.src) return;
    const a = document.createElement("a");
    a.href = image.src;
    a.download = image.alt || "image.png";
    a.click();
  }, [image]);

  if (!image) return null;

  return createPortal(
    <div
      className="image-lightbox-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={image.alt || "Image preview"}
      onClick={close}
    >
      <div className="image-lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <span className="image-lightbox-scale">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          className="image-lightbox-btn"
          onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          title="Zoom out (-)"
        >
          -
        </button>
        <button
          type="button"
          className="image-lightbox-btn"
          onClick={() => setScale(1)}
          title="Reset zoom (0)"
        >
          1:1
        </button>
        <button
          type="button"
          className="image-lightbox-btn"
          onClick={() => setScale((s) => Math.min(4, s + 0.25))}
          title="Zoom in (+)"
        >
          +
        </button>
        <TooltipButton
          type="button"
          className="image-lightbox-btn"
          tooltip="Copy image"
          ariaLabel="Copy image"
          onClick={() => void copyImage()}
        >
          <IconCopy size={15} />
        </TooltipButton>
        <TooltipButton
          type="button"
          className="image-lightbox-btn"
          tooltip="Download"
          ariaLabel="Download"
          onClick={downloadImage}
        >
          <IconDownload size={15} />
        </TooltipButton>
        <TooltipButton
          type="button"
          className="image-lightbox-btn close"
          tooltip="Close (Esc)"
          ariaLabel="Close (Esc)"
          onClick={close}
        >
          <IconClose size={16} />
        </TooltipButton>
      </div>
      <div
        className="image-lightbox-viewport"
        onClick={close}
        onWheel={(e) => {
          e.preventDefault();
          if (e.deltaY < 0) setScale((s) => Math.min(4, s + 0.15));
          else setScale((s) => Math.max(0.5, s - 0.15));
        }}
      >
        <img
          src={image.src}
          alt={image.alt || ""}
          className="image-lightbox-img"
          style={{ transform: `scale(${scale})` }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>,
    document.body,
  );
}
