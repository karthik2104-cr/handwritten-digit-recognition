import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoadingBlock } from "./components/LoadingBlock";

const OverviewPage = lazy(() => import("./pages/OverviewPage").then((module) => ({ default: module.OverviewPage })));
const StudioPage = lazy(() => import("./pages/StudioPage").then((module) => ({ default: module.StudioPage })));
const EvaluationPage = lazy(() => import("./pages/EvaluationPage").then((module) => ({ default: module.EvaluationPage })));
const ExplorerPage = lazy(() => import("./pages/ExplorerPage").then((module) => ({ default: module.ExplorerPage })));
const AboutPage = lazy(() => import("./pages/AboutPage").then((module) => ({ default: module.AboutPage })));

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingBlock label="Loading page" />}>{children}</Suspense>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<LazyPage><OverviewPage /></LazyPage>} />
          <Route path="studio" element={<LazyPage><StudioPage /></LazyPage>} />
          <Route path="evaluation" element={<LazyPage><EvaluationPage /></LazyPage>} />
          <Route path="explorer" element={<LazyPage><ExplorerPage /></LazyPage>} />
          <Route path="about" element={<LazyPage><AboutPage /></LazyPage>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
