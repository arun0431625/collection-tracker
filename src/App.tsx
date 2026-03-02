import { BrowserRouter } from "react-router-dom";
import AppRouter from "./AppRouter";
import { BranchProvider } from "@/context/BranchContext";

export default function App() {
  return (
    <BranchProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </BranchProvider>
  );
}
