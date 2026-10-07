import Simulator from "./Simulator";
import { publicScenarios } from "../lib/scenarios";

// Render per request so scenario files added to scenarios/ show up without a rebuild.
export const dynamic = "force-dynamic";

export default function Page() {
  // Only the public fields are sent to the browser. Faults and readings stay on the server.
  return <Simulator scenarios={publicScenarios()} />;
}
