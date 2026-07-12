import { C } from "../../theme/colors";
import Badge from "./Badge";

export default function statusBadge(s) {
  const map = {
    Approved: [C.teal, C.tealLight],
    "Pending HOD": [C.navy, C.grey200],
    Draft: [C.grey500, C.grey100],
    Rejected: [C.grey800, C.grey200],
    Confirmed: [C.teal, C.tealLight],
    Pending: [C.navy, C.grey200],
    Completed: [C.teal, C.tealLight],
    Upcoming: [C.navy, "#e8eaed"],
  };
  const [c, bg] = map[s] || [C.grey500, C.grey100];
  return <Badge color={c} bg={bg}>{s}</Badge>;
}
