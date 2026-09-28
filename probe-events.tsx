/** Minimal probe: does a React onClick fire at all in this environment? */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register({ url: "http://localhost/" });

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const { createElement, useState } = await import("react");
const { createRoot } = await import("react-dom/client");
const { fireEvent, act } = await import("@testing-library/react");

function Probe() {
  const [n, setN] = useState(0);
  return createElement("button", { onClick: () => setN((v) => v + 1) }, `count ${n}`);
}

const root = createRoot(document.body);
await act(async () => {
  root.render(createElement(Probe));
});
console.info("before:", document.body.textContent);

const btn = document.querySelector("button")!;
fireEvent.click(btn);
await new Promise((r) => setTimeout(r, 100));
console.info("after fireEvent:", document.body.textContent);

btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
await new Promise((r) => setTimeout(r, 100));
console.info("after dispatchEvent:", document.body.textContent);
process.exit(0);
