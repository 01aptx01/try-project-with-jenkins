import { render, screen } from "@testing-library/react";
import HomePage from "../app/page.js";

describe("HomePage", () => {
  it("renders the Meridian heading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Meridian" })).toBeInTheDocument();
  });
});
