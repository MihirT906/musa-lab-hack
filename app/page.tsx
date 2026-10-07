import Simulator from "./Simulator";
import { publicScenarios } from "../lib/scenarios";

export default function Page() {
  // Only the public fields are sent to the browser. Faults and readings stay on the server.
  return <Simulator scenarios={publicScenarios()} />;
}
