import { BrowserRouter } from "react-router-dom";
import AppRouter from "./AppRouter";
import { BranchProvider } from "@/context/BranchContext";
import { ViewerProvider } from "@/context/ViewerContext";
import { Toaster } from "sonner";

export default function App() {
  return (
    <BranchProvider>
      <ViewerProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </ViewerProvider>
    </BranchProvider>
  );
}
