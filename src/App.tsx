import { BrowserRouter } from "react-router-dom";
import AppRouter from "./AppRouter";
import { BranchProvider } from "@/context/BranchContext";
import { Toaster } from "sonner";

export default function App() {
  return (
    <BranchProvider>
      <BrowserRouter>
        <AppRouter />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </BranchProvider>
  );
}
