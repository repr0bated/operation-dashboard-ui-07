import { StateChange, ChangeType, StateFrameKind } from "./src/grpc/gen/operation.js";
const frame = StateChange.fromJson({
  pluginId: "incus",
  memberName: "",
  frameKind: StateFrameKind.INITIAL_STATE,
  newValue: { instances: [{ name: "netmaker" }], profiles: ["default"] },
});
console.log(frame.newValue);
