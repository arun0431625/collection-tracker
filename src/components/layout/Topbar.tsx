import { useBranch } from "../../context/BranchContext";
import { useViewer } from "../../context/ViewerContext";

type Props = {
  onLogout: () => void | Promise<void>;
};

export default function Topbar({ onLogout }: Props) {
  const { branch } = useBranch();
  const { viewer, isViewer } = useViewer();

  return (
    <header className="flex items-center justify-between bg-white border-b px-4 py-2">
      <div className="font-semibold">Collection Tracker</div>

      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-600">
          {isViewer ? (
            <span>
              User: <span className="font-semibold">{viewer?.display_name || viewer?.username}</span>{" "}
              <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded ml-1">Viewer</span>
            </span>
          ) : (
            <span>
              Branch: <span className="font-semibold">{branch}</span>
            </span>
          )}
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
