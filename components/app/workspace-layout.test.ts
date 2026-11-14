import { describe, expect, it } from "vitest";
import { layoutOf } from "./workspace-layout";

describe("layoutOf", () => {
  it("shows form and map while a place is chosen, and hides the results", () => {
    const layout = layoutOf(false, false);
    expect(layout.form).not.toContain("hidden");
    expect(layout.map).not.toContain("hidden");
    expect(layout.results).toBe("hidden");
  });

  it("gives the whole screen to the results, without form or map", () => {
    const layout = layoutOf(true, false);
    expect([layout.intro, layout.form, layout.map]).toEqual(["hidden", "hidden", "hidden"]);
    expect(layout.results).not.toContain("hidden");
    expect(layout.root).toContain("h-dvh");
  });

  it("puts the map beside the results when it is opened from them", () => {
    const layout = layoutOf(true, true);
    expect(layout.form).toBe("hidden");
    expect(layout.map).toContain("lg:col-start-1");
    expect(layout.results).toContain("lg:col-start-2");
  });
});
