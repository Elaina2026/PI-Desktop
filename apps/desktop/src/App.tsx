import { ErrorBoundary } from "./features/app/chrome";
import { AppShell } from "./features/app/AppShell";
import { ImageLightbox } from "./components/ImageLightbox";

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
      <ImageLightbox />
    </ErrorBoundary>
  );
}
