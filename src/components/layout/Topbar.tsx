import { useBranch } from "../../context/BranchContext";

type Props = {
  onLogout: () => void | Promise<void>;
};

export default function Topbar({ onLogout }: Props) {
  const { branch } = useBranch();

  return (
    <header className="flex items-center justify-between bg-white border-b px-4 py-2">
      <div className="font-semibold">Collection Tracker</div>

      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-600">
          Branch: <span className="font-semibold">{branch}</span>
        </div>

        <button
          onClick={onLogout}
          className="text-sm px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
