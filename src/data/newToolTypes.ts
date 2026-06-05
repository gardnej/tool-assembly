export type NewToolOption = {
  id: string;
  label: string;
};

export type NewToolCategory = {
  id: string;
  label: string;
  options: NewToolOption[];
};

/** Fusion Tool Library → New tool picker categories (prototype). */
export const NEW_TOOL_CATEGORIES: NewToolCategory[] = [
  {
    id: "tool-assembly",
    label: "Tool Assembly",
    options: [{ id: "tool-assembly", label: "Tool Assembly" }],
  },
  {
    id: "milling",
    label: "Milling",
    options: [
      { id: "ball-end-mill", label: "Ball end mill" },
      { id: "bull-nose-end-mill", label: "Bull nose end mill" },
      { id: "flat-end-mill", label: "Flat end mill" },
      { id: "face-mill", label: "Face mill" },
      { id: "tapered-mill", label: "Tapered mill" },
      { id: "radius-mill", label: "Radius mill" },
      { id: "engrave-chamfer-mill", label: "Engrave/Chamfer mill" },
      { id: "corner-chamfer-end-mill", label: "Corner chamfer end mill" },
      { id: "dovetail-mill", label: "Dovetail mill" },
      { id: "lollipop-mill", label: "Lollipop mill" },
      { id: "slot-mill", label: "Slot mill" },
      { id: "thread-mill", label: "Thread mill" },
      { id: "circle-segment-barrel", label: "Circle segment barrel" },
      { id: "circle-segment-lens", label: "Circle segment lens" },
      { id: "circle-segment-oval", label: "Circle segment oval" },
      { id: "circle-segment-taper", label: "Circle segment taper" },
    ],
  },
  {
    id: "hole-making",
    label: "Hole making",
    options: [
      { id: "boring-bar", label: "Boring bar" },
      { id: "counter-bore", label: "Counter bore" },
      { id: "drill", label: "Drill" },
      { id: "center-drill", label: "Center drill" },
      { id: "spot-drill", label: "Spot drill" },
      { id: "reamer", label: "Reamer" },
      { id: "counter-sink", label: "Counter sink" },
      { id: "tap-left-hand", label: "Tap left hand" },
      { id: "tap-right-hand", label: "Tap right hand" },
    ],
  },
  {
    id: "turning",
    label: "Turning",
    options: [
      { id: "turning-general", label: "Turning general" },
      { id: "turning-boring", label: "Turning boring" },
      { id: "turning-grooving", label: "Turning grooving" },
      { id: "turning-threading", label: "Turning threading" },
    ],
  },
  {
    id: "cutting",
    label: "Cutting",
    options: [
      { id: "waterjet", label: "Waterjet" },
      { id: "laser-cutter", label: "Laser cutter" },
      { id: "plasma-cutter", label: "Plasma cutter" },
    ],
  },
  {
    id: "probe",
    label: "Probe",
    options: [{ id: "probe", label: "Probe" }],
  },
  {
    id: "adaptive-items",
    label: "Adaptive items",
    options: [
      { id: "tool-block", label: "Tool block" },
      { id: "holder", label: "Holder" },
    ],
  },
  {
    id: "depositing",
    label: "Depositing",
    options: [
      { id: "electric-arc-wire", label: "Electric arc wire" },
      { id: "laser-powder", label: "Laser powder" },
      { id: "laser-wire", label: "Laser wire" },
    ],
  },
];
